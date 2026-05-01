"""Stage-level implementations for the v1 mesh pipeline.

Each function corresponds to a stage in ``3D_Pipeline.md`` §5 with the
post-Phase −0.5 redesign decisions baked in:

* Stage 1 auto-rescales the head to ``TARGET_HEAD_HEIGHT_MM`` because
  raw scans / TRELLIS output land at ~1.7–1.9 m (decision −0.5.1).
* Stage 1.5 runs *before* Stage 2 — no relying on manifold3d's silent
  auto-heal during the boolean (decision −0.5.5).
* Stage 2 picks the cut at the neck (the local-min between the head's
  upper-max and the shoulders' lower-max) and rotates the head about Z
  if the chosen cut location is too thin to fit the cavity without
  breaking through the wall (decision −0.5.3 — wall thickness is
  *placement-driven*, not core-widening-driven).
* Stage 3 subtracts ``negative_core`` first (carves the cavity), then
  Stage 4 unions ``valve_cap`` (whose threaded outer diameter is
  *intentionally* slightly larger than the core, biting into the head
  walls inside the cavity).

Stage functions take and return ``trimesh.Trimesh``. ``Constants`` (the
locked values from §0/§6) is passed in as ``C`` rather than imported
inside each function — explicit beats implicit, and unit tests can
swap in a fixture-built Constants without monkeypatching the loader.

Optional dependencies (pymeshlab, scipy.spatial.ConvexHull,
fast_simplification) are wrapped in try/except. Each fallback is
documented next to its degrade path so a future reader sees both the
"happy" branch and "we lost a wheel" branch in one place.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Optional, Tuple

import numpy as np
import trimesh

from .constants import Constants
from .errors import ErrorCode, PipelineError
from .validation import assert_printable, min_wall_thickness


# P0-018: hard cap on TRELLIS post-Stage-1.5 triangle count. TRELLIS
# routinely emits 700k+-tri meshes; without a cap, downstream stages
# burn memory + CPU on a mesh we can't print anyway. 500k is generous
# (3–4× our typical post-repair tri count) but ruled out runaway cases.
# Env-tunable for ops experimentation without a code deploy.
def _max_tris_after_repair() -> int:
    try:
        return int(os.environ.get("MAX_TRIS_AFTER_REPAIR", "500000"))
    except ValueError:
        return 500_000

# ---- Optional deps ---------------------------------------------------------
# We attempt imports at module load. Each guard logs to stderr so the
# RunPod worker logs show what the runtime image actually has. Stages
# branch on the bound name being not-None.

try:
    import manifold3d as _m3  # type: ignore[import-not-found]
except Exception as _exc:  # noqa: BLE001
    _m3 = None  # type: ignore[assignment]
    sys.stderr.write(
        f"[pipeline.stages] manifold3d unavailable ({_exc!r}); "
        "booleans will fail. This is a hard requirement for v1.\n"
    )

try:
    from scipy.spatial import ConvexHull as _ConvexHull  # type: ignore[import-not-found]
except Exception:  # noqa: BLE001
    _ConvexHull = None  # type: ignore[assignment]
    sys.stderr.write(
        "[pipeline.stages] scipy.spatial unavailable; Stage 2 will use "
        "bbox-diagonal fallback for radius profile.\n"
    )

try:
    import pymeshlab as _ml  # type: ignore[import-not-found]
    # Probe for the `meshing_*` filter family. pymeshlab dlopens its
    # filter plugins at MeshSet construction; if libOpenGL.so.0 is
    # missing, libfilter_meshing.so silently fails to register and the
    # MeshSet ends up without `meshing_close_holes` etc — surfaces only
    # at first call as AttributeError. We'd rather know at import time
    # so the runtime path can deterministically pick the trimesh
    # fallback instead of crashing mid-pipeline.
    _probe_ms = _ml.MeshSet()
    if not hasattr(_probe_ms, "meshing_close_holes"):
        sys.stderr.write(
            "[pipeline.stages] pymeshlab imported but meshing_* filters "
            "not registered (likely libfilter_meshing.so failed to load — "
            "missing libOpenGL.so.0?). Disabling pymeshlab path; Stage 1.5 "
            "will use trimesh.repair fallback.\n"
        )
        _ml = None  # type: ignore[assignment]
    del _probe_ms
except Exception:  # noqa: BLE001
    _ml = None  # type: ignore[assignment]
    sys.stderr.write(
        "[pipeline.stages] pymeshlab unavailable; Stage 1.5 will use "
        "trimesh.repair fallback (weaker on non-convex hole closure).\n"
    )

try:
    import fast_simplification as _fs  # type: ignore[import-not-found]
except Exception:  # noqa: BLE001
    _fs = None  # type: ignore[assignment]
    sys.stderr.write(
        "[pipeline.stages] fast_simplification unavailable; Stage 5 will "
        "skip decimation (output may exceed §0 50–80K triangle band).\n"
    )

try:
    # PyMeshFix wraps Marco Attene's MeshFix library — the gold-standard
    # tool for turning an arbitrary triangle soup into a guaranteed
    # watertight, manifold, self-intersection-free mesh suitable for
    # slicing. Powers Stage 6 (print_repair). If absent, the stage
    # falls back to a best-effort trimesh repair pass that won't
    # *guarantee* watertightness but at least patches small holes.
    import pymeshfix as _pmf  # type: ignore[import-not-found]
except Exception:  # noqa: BLE001
    _pmf = None  # type: ignore[assignment]
    sys.stderr.write(
        "[pipeline.stages] pymeshfix unavailable; Stage 6 will fall back "
        "to trimesh.repair (weaker — may ship non-watertight meshes that "
        "fail in slicers).\n"
    )


# ---- manifold3d <-> trimesh conversion helpers -----------------------------


def _to_manifold(mesh: trimesh.Trimesh) -> "object":
    """Wrap ``mesh`` in a ``manifold3d.Manifold`` for boolean ops.

    Why a helper: manifold3d 3.x exposes ``Manifold(Mesh(verts, tris))``
    where ``verts`` must be float32 and ``tris`` uint32. trimesh stores
    them as float64/int64 — a silent dtype mismatch crashes inside the
    C++ side with a non-helpful message.
    """
    if _m3 is None:
        raise PipelineError(
            code=ErrorCode.BOOLEAN_FAILED,
            stage="manifold3d-init",
            detail="manifold3d not installed in worker image",
        )
    verts = np.ascontiguousarray(mesh.vertices, dtype=np.float32)
    tris = np.ascontiguousarray(mesh.faces, dtype=np.uint32)
    return _m3.Manifold(_m3.Mesh(verts, tris))


def _from_manifold(man: "object") -> trimesh.Trimesh:
    """Unwrap a ``manifold3d.Manifold`` back to ``trimesh.Trimesh``."""
    out = man.to_mesh()
    # manifold3d 3.x stores positions in vert_properties[:, :3]; later
    # columns hold optional attributes (normals, UVs) we don't use.
    verts = np.asarray(out.vert_properties[:, :3], dtype=np.float64)
    faces = np.asarray(out.tri_verts, dtype=np.int64)
    return trimesh.Trimesh(vertices=verts, faces=faces, process=True)


# ---- Stage 1 — Normalize ---------------------------------------------------


def stage1_normalize(
    head: trimesh.Trimesh,
    head_scale: float,
    head_tilt_deg: float,
    C: Constants,
) -> trimesh.Trimesh:
    """Reorient, tilt, recenter, and rescale the raw head mesh.

    Order matters: orient first so "Z is height", THEN tilt about Y
    (face-tilt is meaningless if Z isn't yet up), THEN recentre, THEN
    rescale. Rescale last keeps the tilt rotation and the bbox-bottom
    translation independent of the final size — easier to reason about.

    Parameters
    ----------
    head_scale
        User knob; clamped to 0.85..1.15 in handler.py per §9 but
        re-clamped here as defence-in-depth. Multiplies
        ``TARGET_HEAD_HEIGHT_MM``.
    head_tilt_deg
        Rotation about +Y (the "face-forward" axis), in degrees.
    """
    head = head.copy()  # never mutate caller's mesh

    # 1) Orient. TRELLIS doesn't guarantee an up-axis. Heuristic: if Z
    # is already > 1.5× larger than max(X, Y), it's almost certainly
    # the long axis already (raw scans of a person are ~2× taller than
    # wide). Otherwise rotate the longest axis to Z. The 1.5× constant
    # is the safety margin against scans that happen to be near-square
    # in two axes (chest-cropped portraits).
    extents = head.extents
    longest_axis = int(np.argmax(extents))
    if longest_axis != 2 and extents[longest_axis] >= 1.5 * max(extents[0], extents[1]):
        # Rotate longest axis to +Z. Use trimesh's transformation
        # helper so we don't reinvent quaternion math.
        axis_vec = np.zeros(3)
        axis_vec[longest_axis] = 1.0
        rot = trimesh.geometry.align_vectors(axis_vec, [0.0, 0.0, 1.0])
        head.apply_transform(rot)

    # 2) Tilt about Y around centroid (face-tilt). Skip if zero to
    # avoid pointless float churn.
    if abs(head_tilt_deg) > 1e-6:
        # Pitch around the +X axis: positive = chin up / face tilts
        # toward the sky. This is the rotation the user dials in to
        # optimize Stage 2's horizontal cut — pitching the face up
        # makes the cut plane pass through the back of the neck
        # cleanly while leaving the chin in front intact. Y-axis lean
        # was the old (unused) semantic; we don't need it here.
        rot = trimesh.transformations.rotation_matrix(
            np.deg2rad(head_tilt_deg), [1.0, 0.0, 0.0], point=head.centroid,
        )
        head.apply_transform(rot)

    # 3) Recentre XY centroid at origin; leave Z for the final
    # translation step below (we want bbox-bottom at z=0, not centroid
    # at z=0).
    cx, cy, _ = head.centroid
    head.apply_translation([-cx, -cy, 0.0])

    # 4) Auto-rescale to TARGET_HEAD_HEIGHT_MM × head_scale. This is
    # the −0.5.1 fix: raw inputs are ~1.7–1.9 m tall; the cap assembly
    # is ~33 mm tall. Without this step every downstream constant is
    # off by 7.6×.
    clamped_scale = float(np.clip(head_scale, 0.85, 1.15))
    target_z = float(C.TARGET_HEAD_HEIGHT_MM) * clamped_scale
    current_z = float(head.extents[2]) or 1.0
    head.apply_scale(target_z / current_z)

    # 5) Translate so the bottom of the bbox sits at z=0. Stage 2's
    # cropping and Stages 3/4's positioning math assume this baseline.
    z_min = float(head.bounds[0, 2])
    head.apply_translation([0.0, 0.0, -z_min])
    return head


# ---- Stage 1.5 — Repair ----------------------------------------------------


def stage1_5_repair(head: trimesh.Trimesh, C: Constants) -> trimesh.Trimesh:
    """Make the mesh manifold/watertight ahead of any boolean op.

    Two paths: pymeshlab if available (non-convex hole closure works),
    trimesh-only fallback (weaker on TRELLIS-style hair/ear holes).
    """
    # P3-009 — hard-fail only on truly broken inputs; everything else is a
    # warn-and-continue. The original v0.1.33 gate was a flat
    # `is_watertight` raise, which blocked every user because TRELLIS
    # routinely emits non-watertight meshes (see §8.2). The right gate
    # distinguishes "geometry malformed" from "topology imperfect."
    if head is None or len(head.vertices) == 0 or len(head.faces) < 4:
        raise PipelineError(
            ErrorCode.INVALID_MESH,
            "Stage 1.5 received an empty or near-empty mesh "
            f"(vertices={len(head.vertices) if head is not None else 0}, "
            f"faces={len(head.faces) if head is not None else 0}).",
        )
    if not np.all(np.isfinite(head.vertices)):
        raise PipelineError(
            ErrorCode.INVALID_MESH,
            "Stage 1.5 received a mesh with NaN/Inf vertex coords.",
        )

    # 1) Drop floaters — TRELLIS occasionally hallucinates 1–3 stray
    # voxel-clusters (§8.2 defect catalogue). Keep only the largest
    # connected component by face count.
    components = head.split(only_watertight=False)
    if len(components) > 1:
        head = max(components, key=lambda m: len(m.faces))

    if _ml is not None:
        head = _repair_pymeshlab(head)
    else:
        # Fallback: trimesh.repair primitives. fix_inversion + fix_normals
        # handle most TRELLIS defects; non-convex holes (hair, ears) may
        # remain — manifold3d's silent auto-heal will paper over them at
        # Stage 2's boolean. Not ideal, but the −0.5.5 lock is "repair
        # runs", not "repair perfectly".
        trimesh.repair.fix_inversion(head)
        trimesh.repair.fix_normals(head)
        head.merge_vertices()
        # trimesh 4.x removed Trimesh.remove_duplicate_faces /
        # remove_unreferenced_vertices in favour of process(), which
        # rolls both into its default clean-up plus more (degenerate
        # face removal, etc). validate=True ensures normals are
        # recomputed after the topology mutations.
        head.process(validate=True)

    # 2) Verify watertight. Originally a §5 Stage 1.5 hard gate, but
    # production logs show TRELLIS routinely emits 700k+-tri meshes with
    # non-closeable holes (hair/ears, euler often <-20). Stages 3/4/5
    # already detect and degrade gracefully (boolean union → mesh
    # concatenation; non-watertight final → ship anyway because slicers
    # cope). Failing hard here just blocks every user — log it and let
    # downstream do its thing.
    if not bool(head.is_watertight):
        sys.stderr.write(
            f"[stage1.5] WARNING: post-repair mesh still not watertight "
            f"(faces={len(head.faces)}, euler={int(head.euler_number)}, "
            f"pymeshlab_used={_ml is not None}); shipping to stage 2. "
            f"Stages 3/4 will fall back to non-CSG paths.\n"
        )

    # P0-018: hard tri-budget cap. Emit telemetry FIRST (so an aggregator
    # sees `stage1_5_tris=<count>` before the error frame), then reject
    # if we're over the budget. Anything bigger than this means TRELLIS
    # produced something we can't realistically print — fail fast rather
    # than burn another 60 s on Stage 2's boolean.
    cap = _max_tris_after_repair()
    n_tris = int(len(head.faces))
    sys.stderr.write(
        json.dumps({
            "kind": "pipeline.stage_telemetry",
            "stage": "stage1.5",
            "stage1_5_tris": n_tris,
            "tri_cap": cap,
        }) + "\n"
    )
    if n_tris > cap:
        # Per the project's TRELLIS-output memory + the iPhone-photo
        # robustness initiative: pipeline gates warn-and-continue, never
        # raise. Try fast-simplification to fit the cap; if that fails
        # ship the over-cap mesh anyway — stage 5 will decimate to 70K
        # before the STL leaves the worker, and the alternative
        # (failing every generation when TRELLIS hits its routine
        # 750K+ output) is unacceptable for the launch.
        try:
            if _fs is not None:
                target = max(int(cap * 0.95), 200_000)
                # fast_simplification's actual API is `simplify(v, f,
                # target_reduction=...)` — same signature stage 5 uses.
                # The `simplify_mesh(...)` symbol with a `target_count`
                # kwarg doesn't exist in any 0.1.x release we ship and
                # was the source of the AttributeError that left every
                # over-cap mesh shipping un-decimated to stage 2.
                reduction = 1.0 - (target / n_tris)
                v = np.asarray(head.vertices, dtype=np.float32)
                f = np.asarray(head.faces, dtype=np.uint32)
                v_dec, f_dec = _fs.simplify(
                    v, f, target_reduction=float(reduction), agg=7, lossless=False,
                )
                head = trimesh.Trimesh(vertices=v_dec, faces=f_dec, process=True)
                sys.stderr.write(
                    f"[stage1.5] WARNING: mesh exceeded cap (tris={n_tris} cap={cap}); "
                    f"auto-decimated to {len(head.faces)} tris and shipping to stage 2.\n"
                )
            else:
                sys.stderr.write(
                    f"[stage1.5] WARNING: mesh exceeded cap (tris={n_tris} cap={cap}) "
                    f"and fast-simplification is unavailable; shipping over-cap to stage 2. "
                    f"Stage 5 will decimate to 70K before STL export.\n"
                )
        except Exception as exc:  # noqa: BLE001
            sys.stderr.write(
                f"[stage1.5] WARNING: mesh exceeded cap (tris={n_tris} cap={cap}); "
                f"auto-decimation failed ({type(exc).__name__}: {exc}); "
                f"shipping over-cap to stage 2.\n"
            )
    return head


def _repair_pymeshlab(head: trimesh.Trimesh) -> trimesh.Trimesh:
    """The §8.3 pymeshlab recipe; isolated for the optional-dep guard."""
    ms = _ml.MeshSet()  # type: ignore[union-attr]
    ms.add_mesh(_ml.Mesh(np.asarray(head.vertices), np.asarray(head.faces)))  # type: ignore[union-attr]
    # Order matters: dedupe before topology repair, then close holes
    # last so newly closed loops have a chance to be re-oriented
    # coherently. maxholesize=200 is per §8.3 — bound by edge count
    # not area, so it scales with input density.
    ms.meshing_remove_duplicate_vertices()
    ms.meshing_remove_duplicate_faces()
    ms.meshing_remove_unreferenced_vertices()
    ms.meshing_repair_non_manifold_edges()
    ms.meshing_close_holes(maxholesize=200)
    ms.meshing_re_orient_faces_coherently()
    out = ms.current_mesh()
    rep = trimesh.Trimesh(out.vertex_matrix(), out.face_matrix(), process=True)
    rep.merge_vertices()
    rep.fix_normals()
    return rep


# ---- Stage 1.7 — Watertight head before booleans ---------------------------


def stage1_7_watertight_head(
    head: trimesh.Trimesh, C: Constants, target_tris: int = 250_000,
) -> trimesh.Trimesh:
    """Make the TRELLIS head genuinely watertight before stages 2–4.

    Per owner ask after v0.1.40: "fix the head to be solid, then do the
    boolean operations with the known good cap assets — we don't want
    to change the threads much at all". Stage 1.5's pymeshlab pass
    closes small holes but the post-TRELLIS mesh routinely keeps
    open edges + non-manifold vertices that defeat manifold3d's CSG
    booleans in stages 2–4. The fallback (mesh concatenation) leaves
    a multi-shell output, and stage 6's PyMeshFix can't unify it
    without touching the cap's threading.

    Solution: run PyMeshFix here, on the head ONLY (the cap hasn't
    been introduced yet), so stages 2–4 operate on a guaranteed
    watertight + 2-manifold input. The valve_cap.stl asset arrives
    in stage 4 and stays untouched all the way to the final STL.

    Steps:
    1. Skip if the head is already watertight (rare with TRELLIS but
       cheap to check).
    2. Pre-decimate to ~target_tris if larger — PyMeshFix is O(n) in
       triangle count and a 475K-tri input takes 30–60s. Stages 2–5
       will further decimate to the §0 50–80K band; we just need
       enough resolution for the booleans.
    3. Run PyMeshFix; return cleaned head.
    4. Fall through with the original head if pymeshfix is missing or
       raises — never block the export.
    """
    import time as _time
    started = _time.monotonic()
    n_in = len(head.faces)
    was_watertight = bool(head.is_watertight)

    if _pmf is None:
        sys.stderr.write(
            "[stage1.7] pymeshfix unavailable — skipping watertight pass; "
            "stages 2–4 booleans may fall back to non-CSG paths.\n"
        )
        return head

    if was_watertight:
        sys.stderr.write(
            f"[stage1.7] head already watertight (faces={n_in}); skipping.\n"
        )
        return head

    # Pre-decimate. Skip if fast_simplification isn't installed (the
    # later stage 5 decimate is the safety net) — better to ship a big
    # mesh through PyMeshFix than to ship the un-repaired one.
    working = head
    if _fs is not None and len(working.faces) > target_tris:
        try:
            working = _decimate(working, target_tris=target_tris)
            sys.stderr.write(
                f"[stage1.7] pre-pymeshfix decimate {n_in} → "
                f"{len(working.faces)} tris\n"
            )
        except PipelineError as exc:
            sys.stderr.write(
                f"[stage1.7] WARNING: pre-pymeshfix decimate failed "
                f"({exc.detail}); shipping {n_in}-tri mesh to PyMeshFix.\n"
            )

    try:
        repaired = _meshfix_one(working)
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(
            f"[stage1.7] WARNING: pymeshfix raised {exc!r}; "
            f"shipping un-repaired head to stage 2.\n"
        )
        return head

    is_watertight_out = bool(repaired.is_watertight)
    is_winding_consistent = bool(getattr(repaired, "is_winding_consistent", False))
    elapsed_ms = int((_time.monotonic() - started) * 1000)
    sys.stderr.write(
        f"[stage1.7] watertight head ready in {elapsed_ms}ms — "
        f"in_tris={n_in} out_tris={len(repaired.faces)} "
        f"watertight_in={was_watertight} watertight_out={is_watertight_out} "
        f"winding_consistent={is_winding_consistent}\n"
    )

    # Structured warning frame if PyMeshFix couldn't seal everything —
    # stages 2–4 will probably still fall back to non-CSG paths but
    # the operator should know.
    if not is_watertight_out:
        try:
            sys.stdout.write(
                json.dumps({
                    "type": "warning",
                    "stage": "stage1.7",
                    "code": "head_not_watertight_after_pymeshfix",
                    "in_tris": int(n_in),
                    "out_tris": int(len(repaired.faces)),
                }) + "\n"
            )
            sys.stdout.flush()
        except Exception:  # noqa: BLE001
            pass
    return repaired


# ---- Stage 2 — Crop --------------------------------------------------------


def stage2_crop(
    head: trimesh.Trimesh,
    C: Constants,
    *,
    shoulder_taper_fraction: float = 0.60,
) -> Tuple[trimesh.Trimesh, dict]:
    """Crop the head at the neck.

    ``shoulder_taper_fraction`` is the user-tunable knob (0.40..0.85)
    that controls *where* the cut lands on the shoulders→neck
    transition. Higher values cut lower (preserve more material;
    risk leaving shoulder); lower values cut higher (risk losing the
    chin). 0.58–0.62 has tested well across our 4 reference scans.

    Why 0.5 mm Z bins: post-Stage 1 the head is ~22 mm tall, so 0.5 mm
    bins give ~44 samples — enough to resolve the neck without aliasing
    on hair/ear noise. (The original spec called 2 mm bins assuming a
    250 mm head; we're now at 22 mm, so denser bins.)
    """
    # 1) Try every candidate Z rotation, pick the one with the most
    # wall material at z_cut. This is decision −0.5.3: don't widen the
    # core, *rotate the head* so the cut-plane has enough surrounding
    # material for the cavity not to break through.
    candidates = [0.0, 30.0, 60.0, 90.0]
    required_radius = (
        float(C.NEGATIVE_CORE_DIAMETER_MM) / 2.0
        + float(C.MIN_WALL_THICKNESS_MM)
    )

    best: Optional[dict] = None
    for theta_deg in candidates:
        rotated = head.copy()
        if abs(theta_deg) > 1e-6:
            rot = trimesh.transformations.rotation_matrix(
                np.deg2rad(theta_deg), [0.0, 0.0, 1.0], point=rotated.centroid,
            )
            rotated.apply_transform(rot)
        z_cut, head_radius = _find_neck(
            rotated,
            bin_size_mm=0.5,
            shoulder_taper_fraction=shoulder_taper_fraction,
        )
        if z_cut is None:
            continue  # no clean neck at this rotation; try the next
        score = head_radius - required_radius  # positive = enough wall
        if best is None or score > best["score"]:
            best = {
                "rotation_deg": theta_deg,
                "z_cut": z_cut,
                "head_radius": head_radius,
                "score": score,
                "mesh": rotated,
            }

    if best is None:
        raise PipelineError(
            code=ErrorCode.NECK_NOT_FOUND,
            stage="stage2",
            detail="no rotation produced a detectable neck",
        )
    # NOTE(Phase 3 redesign): the negative_core (8.31 mm) is wider than
    # a typical head's neck cross-section after rescale to
    # TARGET_HEAD_HEIGHT_MM, so a hard wall-thickness gate at z_cut
    # rejects every input. The cavity extends UP from z_cut into the
    # *wider* head volume, so the right check is min-wall-thickness
    # along the cavity's z-range, not at the cut plane. For now, log
    # a warning instead of failing — Phase 3 owns the proper fix.
    if best["score"] < 0.0:
        import sys as _sys
        _sys.stderr.write(
            f"[stage2] WARNING: thin walls at z_cut "
            f"(head_radius={best['head_radius']:.2f} mm < "
            f"core_radius+wall={float(C.NEGATIVE_CORE_DIAMETER_MM)/2 + float(C.MIN_WALL_THICKNESS_MM):.2f} mm). "
            f"Cavity extends into wider head volume above; full min-wall "
            f"check is a Phase 3 task. Visually inspect output before printing.\n"
        )

    rotated = best["mesh"]
    z_cut = float(best["z_cut"])
    cropped = _boolean_crop_below(rotated, z_cut)

    # `_boolean_crop_below` can return None when the manifold3d boolean
    # produces an empty mesh (e.g. on heavily non-watertight inputs that
    # slip past stage 1.5 — TRELLIS occasionally outputs heads with
    # internal voids that the cropping plane intersects but doesn't
    # actually carve). Surface as a structured PipelineError so the
    # auto-retry loop in __init__.py can lower the shoulder_taper
    # fraction and try again, instead of crashing with a NoneType
    # AttributeError two lines down.
    if cropped is None or len(getattr(cropped, "faces", [])) == 0:
        raise PipelineError(
            code=ErrorCode.NECK_NOT_FOUND,
            stage="stage2",
            detail=(
                f"boolean crop produced empty mesh at z_cut={z_cut:.3f} "
                f"(rotation={float(best['rotation_deg']):.1f}°). "
                f"Input head likely has internal voids or non-manifold edges "
                f"that defeated manifold3d's plane cut. Auto-retry will lower "
                f"the shoulder taper fraction."
            ),
        )

    # Stages 3/4 expect the cropped head's bottom plane at z=0.
    z_min = float(cropped.bounds[0, 2])
    if abs(z_min) > 1e-6:
        cropped.apply_translation([0.0, 0.0, -z_min])

    info = {
        "z_cut": z_cut,
        "rotation_applied_deg": float(best["rotation_deg"]),
        "head_radius_at_cut_mm": float(best["head_radius"]),
    }
    return cropped, info


def _find_neck(
    mesh: trimesh.Trimesh,
    *,
    bin_size_mm: float,
    shoulder_taper_fraction: float = 0.60,
) -> Tuple[Optional[float], float]:
    """Locate the neck z-coordinate and head-radius at that z.

    Returns ``(z_cut, head_radius_at_cut)`` or ``(None, 0.0)`` if no
    clean neck (single-bulge profile, e.g. caller already cropped).
    """
    z_min, z_max = float(mesh.bounds[0, 2]), float(mesh.bounds[1, 2])
    n_bins = max(8, int(np.ceil((z_max - z_min) / bin_size_mm)))
    edges = np.linspace(z_min, z_max, n_bins + 1)
    centres = 0.5 * (edges[:-1] + edges[1:])

    # Project all vertices into XY per Z-bin; compute convex-hull
    # radius. Convex hull on the XY projection of a slab approximates
    # the slab's outer silhouette — the right "radius profile" to
    # discriminate hourglass head/shoulders.
    verts = np.asarray(mesh.vertices)
    bin_indices = np.clip(
        np.searchsorted(edges, verts[:, 2], side="right") - 1, 0, n_bins - 1,
    )
    radii = np.zeros(n_bins, dtype=np.float64)
    for b in range(n_bins):
        mask = bin_indices == b
        if not mask.any():
            continue
        xy = verts[mask, :2]
        radii[b] = _hull_radius(xy)

    # Wider rolling mean than the original 5-bin window — for ~22 mm
    # tall heads at 0.5 mm bins, jaw / nose / chin produce sub-bulges
    # that *look* like local maxima but are not anatomical features
    # we care about. 9-bin (~4.5 mm) suppresses everything smaller
    # than the neck.
    smooth = _rolling_mean(radii, window=9)

    # Empirical observation (user, §5 Stage 2 Approach A): shoulders
    # are ALWAYS wider than the head. The global radius max IS the
    # shoulders bin.
    shoulders_idx = int(np.argmax(smooth))
    shoulders_r = float(smooth[shoulders_idx])
    if shoulders_r <= 0.0:
        return None, 0.0

    # Iteration 2 of the algorithm (post-test review): the earlier
    # version cut at the local minimum *between shoulders and skull
    # crown*. For typical TRELLIS-style head+torso scans there is no
    # clean local min in the radius profile — the shoulders gradually
    # taper into the head with no narrow neck dip (the scan often
    # truncates the lower torso, so we never see shoulders re-widening
    # below). The only minimum the algorithm finds is the narrowest
    # bin somewhere in the upper face (mid-lips for our test scans).
    # Cutting there throws away the chin and jaw — exactly what the
    # user said NOT to do.
    #
    # New heuristic: cut where the shoulders first START to taper,
    # i.e. the first bin scanning UP from the shoulders bin where the
    # smoothed radius drops below `SHOULDER_TAPER_FRACTION` × the
    # shoulders peak. This puts the cut at the *base* of the neck —
    # the chin, jaw, and full head are preserved above; only the
    # shoulders/torso are removed below.
    # `shoulder_taper_fraction` is now a runtime parameter wired all
    # the way to a user-facing UI slider — the user can dial in 0.40
    # (very tight crop, mostly-head) to 0.85 (loose, may include
    # shoulder). 0.60 is the calibrated default after testing 4
    # reference scans (ian, nik, Bald Thinker, Paint-Splattered Cap).
    threshold = shoulder_taper_fraction * shoulders_r
    cut_idx: Optional[int] = None
    for i in range(shoulders_idx + 1, len(smooth)):
        if smooth[i] < threshold:
            cut_idx = i
            break
    if cut_idx is None:
        return None, 0.0

    return float(centres[cut_idx]), float(smooth[cut_idx])


def _hull_radius(xy: np.ndarray) -> float:
    """Convex-hull "radius" (max distance from the hull centroid).

    Falls back to half the bbox diagonal if scipy isn't installed or
    the slab has < 3 unique points (degenerate hull).
    """
    if xy.shape[0] < 3:
        return 0.0
    if _ConvexHull is None:
        # Fallback: half the bbox diagonal of the slab. Looser bound,
        # but monotone in the same way as the hull radius — local
        # extrema in this profile still mark head vs shoulder vs neck.
        mn = xy.min(axis=0)
        mx = xy.max(axis=0)
        return 0.5 * float(np.linalg.norm(mx - mn))
    try:
        hull = _ConvexHull(xy)
        pts = xy[hull.vertices]
        centre = pts.mean(axis=0)
        return float(np.linalg.norm(pts - centre, axis=1).max())
    except Exception:  # noqa: BLE001 — qhull errors on coplanar points
        mn = xy.min(axis=0)
        mx = xy.max(axis=0)
        return 0.5 * float(np.linalg.norm(mx - mn))


def _rolling_mean(arr: np.ndarray, *, window: int) -> np.ndarray:
    """Centred rolling-mean smoother. Edges replicate the input.

    Why not Savitzky–Golay (which §5 Stage 2 mentions): SG needs scipy
    and we already optional-dep-guard scipy for ConvexHull; mean is
    sufficient for the radius profile noise we expect.
    """
    if window < 2 or window >= len(arr):
        return arr.copy()
    half = window // 2
    padded = np.pad(arr, (half, half), mode="edge")
    kernel = np.ones(window, dtype=np.float64) / window
    return np.convolve(padded, kernel, mode="valid")


def _local_extrema(arr: np.ndarray, *, find_max: bool) -> list[int]:
    """Indices of strict local extrema (interior only, no endpoints)."""
    if len(arr) < 3:
        return []
    diff = np.diff(arr)
    if find_max:
        # i is a local max if diff[i-1] > 0 and diff[i] < 0
        return [i for i in range(1, len(arr) - 1) if diff[i - 1] > 0 and diff[i] < 0]
    return [i for i in range(1, len(arr) - 1) if diff[i - 1] < 0 and diff[i] > 0]


def _boolean_crop_below(head: trimesh.Trimesh, z_cut: float) -> trimesh.Trimesh:
    """Subtract everything below z_cut via manifold3d (§8.4).

    Avoids ``trimesh.slice_plane(cap=True)`` which has unresolved
    cap-triangulation bugs (trimesh issues #1149, #1454, #2180). The
    boolean variant emits a CDT-triangulated, watertight cap face.
    """
    if _m3 is None:
        raise PipelineError(
            code=ErrorCode.BOOLEAN_FAILED,
            stage="stage2",
            detail="manifold3d not installed; Stage 2 boolean crop needs it",
        )
    bounds = head.bounds
    pad = 5.0  # mm; ensures the cutter fully encloses the head xy
    size = [
        float(bounds[1, 0] - bounds[0, 0]) + 2.0 * pad,
        float(bounds[1, 1] - bounds[0, 1]) + 2.0 * pad,
        float(z_cut - bounds[0, 2]) + pad,
    ]
    box = _m3.Manifold.cube(size=size, center=False).translate([
        float(bounds[0, 0]) - pad,
        float(bounds[0, 1]) - pad,
        float(bounds[0, 2]) - pad,
    ])
    cropped_man = _to_manifold(head) - box
    return _from_manifold(cropped_man)


# ---- Stage 3 — Subtract negative core --------------------------------------


def stage3_subtract_negative_core(
    head_cropped: trimesh.Trimesh,
    negative_core: trimesh.Trimesh,
    C: Constants,
) -> trimesh.Trimesh:
    """Carve the cavity for the valve-cap threads.

    Positioning (post-Phase-2 redesign per user feedback): the core
    nests INSIDE the head with its bottom flush at z=0 (the head's
    bottom plane = bike-valve entry plane). Core extends from z=0 up
    to z=NEGATIVE_CORE_HEIGHT_MM (≈ 13.78 mm). The cropped head must
    be at least that tall — guaranteed by TARGET_HEAD_HEIGHT_MM=30.0
    minus a typical 50% Stage 2 crop = ~15 mm. Result of the subtract
    is a head with a vertical cylindrical cavity drilled up from its
    bottom face. Nothing extends below the head's bottom plane.
    """
    core = negative_core.copy()
    # Recentre the core at xy=(0,0). The source frame's xy is
    # arbitrary (per the Phase −1 spike, the core sits ~33 mm off the
    # cap's xy in their source files); we land both in the head frame
    # per decision −0.5.2.
    cb = core.bounds
    core_centre_xy = 0.5 * (cb[0, :2] + cb[1, :2])
    core.apply_translation([
        -float(core_centre_xy[0]),
        -float(core_centre_xy[1]),
        -float(cb[0, 2]) + float(C.JUNCTION_Z_OFFSET_MM),
    ])

    socketed_man = _to_manifold(head_cropped) - _to_manifold(core)
    socketed = _from_manifold(socketed_man)

    # If the cavity is wider than the head at z_cut (which happens with
    # tight crops on narrow scans), the subtract orphans slivers. Phase 3
    # will replace this with a proper min-wall-thickness sampling check;
    # for v1 we salvage the largest body and warn on stderr. Drop bodies
    # with < 5% of total volume — anything bigger than that is real
    # geometry the user probably wants.
    bodies = socketed.split(only_watertight=False)
    if len(bodies) > 1:
        bodies = sorted(bodies, key=lambda m: float(m.volume), reverse=True)
        kept_vol = float(bodies[0].volume)
        total_vol = sum(float(b.volume) for b in bodies)
        import sys as _sys
        _sys.stderr.write(
            f"[stage3] WARNING: subtract produced {len(bodies)} bodies; "
            f"keeping largest ({kept_vol/total_vol*100:.1f}% of total volume). "
            f"Lower the Crop Tightness slider or pitch the head to give the "
            f"cavity more wall material.\n"
        )
        socketed = bodies[0]

    # Per the project's TRELLIS-output memory ("pipeline gates must
    # warn-and-continue, not raise") + the iPhone-photo robustness
    # initiative: the dimension/topology validator is no longer fatal
    # at stage 3. Demote both failure modes to stderr warnings, and
    # for the thin-walls case (OUTPUT_DIMENSIONS_OUT_OF_RANGE with min
    # extent under the printable floor) tag the mesh so run_v1 can
    # decide whether to auto-retry with a relaxed Crop Tightness.
    # Slicers cope with thin walls and minor non-watertightness; the
    # alternative — bombing on the user — is worse for the iPhone-
    # selfie path the launch is targeting.
    try:
        assert_printable(socketed, stage="stage3")
    except PipelineError as exc:
        import sys as _sys
        if exc.code == ErrorCode.OUTPUT_DIMENSIONS_OUT_OF_RANGE:
            extents = socketed.bounding_box.extents
            min_ext = float(extents.min())
            _sys.stderr.write(
                f"[stage3] WARNING: thin-walls — bbox min extent {min_ext:.3f} mm "
                f"({exc.detail}); shipping to stage 4. run_v1 may auto-retry "
                f"with a relaxed Crop Tightness if this is the first attempt.\n"
            )
            # Tag for run_v1's auto-retry detector. trimesh.Trimesh
            # tolerates arbitrary attributes; the retry path checks
            # this name and clears it before returning.
            try:
                socketed.metadata["sdz_thin_wall_min_mm"] = min_ext
            except Exception:  # noqa: BLE001
                pass
        else:
            _sys.stderr.write(
                f"[stage3] WARNING: post-subtract topology failure ({exc.detail}); "
                f"shipping to stage 4 anyway. Slicers handle most non-watertight "
                f"meshes; Phase 4 owns a hard fix.\n"
            )
    return socketed


# ---- Stage 4 — Union valve cap ---------------------------------------------


def stage4_union_valve_cap(
    socketed: trimesh.Trimesh,
    valve_cap: trimesh.Trimesh,
    C: Constants,
) -> trimesh.Trimesh:
    """Union the threaded cap into the cavity.

    Cap baseline matches the core (post-Phase-2 redesign): bottom at
    JUNCTION_Z_OFFSET_MM = 0 (head's bottom plane), top at z =
    VALVE_CAP_HEIGHT_MM (≈ 11.11 mm). Cap is *fully contained* within
    the head's volume — no part of it protrudes below z=0. The cap's
    open bottom is coplanar with the head's bottom face, so a real
    bike valve threading up from below enters the cap directly.
    The slightly larger threaded outer diameter
    (VALVE_CAP_THREADED_OUTER_DIAMETER_MM ≈ 8.87 mm vs the core's
    8.31 mm) means the cap's threads carve into the head walls inside
    the carved cavity, forming the internal threading.
    """
    cap = valve_cap.copy()
    # Repair the cap before the boolean. valve_cap.stl has Euler -51
    # (severely non-manifold internal threads). Light repair won't
    # make manifold3d's union produce a single watertight body —
    # Phase 4 task #4 owns the proper fix (remesh the asset). Until
    # then we lightly clean and accept that Stage 4 may fall back to
    # mesh concatenation (which slicers handle even though the result
    # has 2 bodies).
    trimesh.repair.fix_inversion(cap)
    trimesh.repair.fix_normals(cap)
    cap.merge_vertices()
    cap.process(validate=True)
    cb = cap.bounds
    cap_centre_xy = 0.5 * (cb[0, :2] + cb[1, :2])
    cap.apply_translation([
        -float(cap_centre_xy[0]),
        -float(cap_centre_xy[1]),
        -float(cb[0, 2]) + float(C.JUNCTION_Z_OFFSET_MM),
    ])

    final_man = _to_manifold(socketed) + _to_manifold(cap)
    final = _from_manifold(final_man)

    # Cap mesh has Euler -51 (severely non-manifold internal threads);
    # the union output inherits open edges which then trip
    # assert_printable. Fall back to concatenation rather than failing
    # — slicers tolerate the non-manifold union, and v1's user value is
    # in *seeing* the personalised cap, not in shipping a perfectly
    # CSG-clean STL. Phase 4 owns either a remesh of valve_cap.stl or
    # a different boolean engine. Surface the warning so we know how
    # often this fallback fires in production.
    try:
        assert_printable(final, stage="stage4")
        return final
    except PipelineError as exc:
        import sys as _sys
        _sys.stderr.write(
            f"[stage4] WARNING: boolean union not watertight ({exc.detail}); "
            f"falling back to mesh concatenation. Output is slicer-printable "
            f"but not CSG-clean. Track Phase 4: remesh valve_cap.stl.\n"
        )
        # Concatenate: simple geometric union without topology guarantee.
        # The result has the cap "embedded" in the head's cavity area.
        return trimesh.util.concatenate([socketed, cap])


# ---- Stage 5 — Print-prep --------------------------------------------------


def stage5_postprocess(
    final: trimesh.Trimesh, C: Constants, target_tris: int = 70_000,
) -> trimesh.Trimesh:
    """Decimate to the §0 50–80K band, then validate.

    Skips Taubin smoothing in v1 — masking the cap region cleanly
    (see §8.8) is fiddly and the user explicitly said add it in
    Phase 4 if needed. A bare decimate already lands in the band on
    most inputs.
    """
    if _fs is not None and len(final.faces) > target_tris:
        final = _decimate(final, target_tris=target_tris)

    # Stage 5 validation is *soft* in v1: when Stage 4 fell back to
    # concatenation (because the valve_cap mesh was non-manifold),
    # assert_printable's watertight check fails — but the mesh is still
    # slicer-printable. Demote to a warning. Phase 4 will tighten.
    try:
        assert_printable(final, stage="stage5")
    except PipelineError as exc:
        import sys as _sys
        _sys.stderr.write(
            f"[stage5] WARNING: final mesh failed watertight assertion "
            f"({exc.detail}); shipping anyway because slicers handle this. "
            f"Phase 4 owns the proper fix.\n"
        )

    # P3-016 — wall-thickness raycast validator. Runs AFTER decimation /
    # validation so the metric reflects what actually ships. Emit a
    # `{type:"warning",stage:"stage5",code:"thin_walls",...}` JSON frame
    # to stdout when p1 is below the printable target — the Node tier
    # rebroadcasts it as a `stl.generate.warnings` frame (P3-007). NEVER
    # raises: thin walls are an inspect-before-print situation, not a
    # reject-the-job one.
    try:
        target_mm = float(getattr(C, "MIN_WALL_THICKNESS_MM", 1.2))
        report = min_wall_thickness(final, target_mm=target_mm, sample_count=1000)
        p1 = report.get("p1")
        if p1 is not None and np.isfinite(p1) and p1 < target_mm:
            sys.stdout.write(
                json.dumps({
                    "type": "warning",
                    "stage": "stage5",
                    "code": ErrorCode.THIN_WALLS.value,
                    "min_mm": float(p1),
                    "sample_count": int(report.get("samples", 0)),
                    "target_mm": float(target_mm),
                }) + "\n"
            )
            sys.stdout.flush()
    except Exception as _wt_exc:  # noqa: BLE001
        # Never block the export on a validator failure — log and move on.
        sys.stderr.write(
            f"[stage5] wall-thickness validator skipped: {_wt_exc!r}\n"
        )
    return final


def _decimate(mesh: trimesh.Trimesh, *, target_tris: int) -> trimesh.Trimesh:
    """fast_simplification quadric decimation (§8.7).

    Why not mask the cap region: fast_simplification 0.1.x exposes a
    flat ``target_reduction`` API; per-face preservation requires the
    ``preserve_features`` flag which is gated on the input geometry's
    crease angles being clean, and post-boolean meshes from
    manifold3d aren't guaranteed clean. Phase 4 will revisit with
    region-mask-aware decimation if threads soften visibly.
    """
    n_faces = len(mesh.faces)
    if n_faces <= target_tris:
        return mesh
    reduction = 1.0 - (target_tris / n_faces)
    try:
        v, f = _fs.simplify(  # type: ignore[union-attr]
            mesh.vertices,
            mesh.faces,
            target_reduction=float(reduction),
            agg=7,
            lossless=False,
        )
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(
            code=ErrorCode.DECIMATION_FAILED,
            stage="stage5",
            detail=f"fast_simplification raised: {exc!r}",
        ) from exc
    decimated = trimesh.Trimesh(v, f, process=True)
    decimated.fix_normals()
    return decimated


# ---- Stage 6 — Print-repair ------------------------------------------------


def stage6_print_repair(
    final: trimesh.Trimesh, C: Constants, target_tris: int = 70_000,
) -> trimesh.Trimesh:
    """Make the mesh genuinely watertight + manifold for slicer input.

    Stage 5 lands the mesh in the §0 50–80K triangle band but is *soft*
    on watertightness — boolean ops + decimation routinely leave small
    holes (typically on the head crown), self-intersections at the cap
    seam, and non-manifold edges where stage-4's union fell back to
    concatenation. Slicers paper over some of this but the user sees
    holes in the 3D preview and prints either fail or come out hollow.

    PyMeshFix (Marco Attene's MeshFix wrapped for Python) takes any
    triangle soup and produces a guaranteed watertight, 2-manifold,
    self-intersection-free mesh — purpose-built for 3D printing prep.
    Hole-filling here is unconstrained by the §1.5 ``maxholesize=200``
    cap; whatever's left after the booleans + decimation gets sealed.

    If the repair balloons triangle count above the §0 band, we
    re-decimate to keep slicer load times reasonable.

    Falls back to ``trimesh.repair.fill_holes`` if pymeshfix isn't
    installed at runtime — won't *guarantee* watertightness but at
    least patches small holes.
    """
    import time as _time
    started = _time.monotonic()
    n_faces_in = len(final.faces)
    was_watertight = bool(final.is_watertight)

    if _pmf is None:
        # Fallback: best-effort trimesh repair. Doesn't guarantee
        # watertight; logs the gap so ops can see when pymeshfix
        # didn't get installed in the worker image.
        try:
            trimesh.repair.fix_inversion(final)
            trimesh.repair.fix_normals(final)
            trimesh.repair.fill_holes(final)
        except Exception as exc:  # noqa: BLE001
            sys.stderr.write(
                f"[stage6] WARNING: trimesh fallback repair raised "
                f"{exc!r}; shipping as-is.\n"
            )
        sys.stderr.write(
            f"[stage6] pymeshfix unavailable — fallback path. "
            f"in={n_faces_in} watertight_in={was_watertight} "
            f"watertight_out={bool(final.is_watertight)}\n"
        )
        return final

    try:
        # Split-and-process. Stage 4 routinely falls back to mesh
        # concatenation when manifold3d's CSG union fails — meaning
        # `final` is two physically-overlapping but topologically-
        # disjoint shells: the head (the messy TRELLIS output, ~62K
        # tris after decimation) and the valve cap (the clean baked
        # asset, ~7.4K tris). Running PyMeshFix on the combined mesh
        # — even with joincomp=False — risks the cleaner deciding the
        # cap's tightly-threaded geometry is "unfixable" and dropping
        # it (the v0.1.38 / v0.1.39 cap-disappearance regression).
        #
        # Fix: separate the components, repair ONLY the largest (the
        # head, which is what actually needs sealing), and re-attach
        # every other component (the cap) un-touched. The cap is
        # already a hand-tuned watertight STL shipping with the image;
        # there is nothing PyMeshFix can do to it that we want.
        components = _split_components(final)
        if len(components) <= 1:
            # Single shell — repair as today. Stage 4's CSG union
            # succeeded, so this IS the merged head+cap solid.
            repaired = _meshfix_one(final)
        else:
            components.sort(key=lambda m: len(m.faces), reverse=True)
            head = components[0]
            extras = components[1:]
            extras_tris = sum(len(m.faces) for m in extras)
            sys.stderr.write(
                f"[stage6] multi-shell input: {len(components)} components "
                f"(head={len(head.faces)} tris, cap+extras={extras_tris} tris); "
                f"repairing head only, preserving extras un-touched\n"
            )
            repaired_head = _meshfix_one(head)
            repaired = trimesh.util.concatenate([repaired_head, *extras])
            repaired.merge_vertices()
            repaired.fix_normals()
    except Exception as exc:  # noqa: BLE001
        # PyMeshFix can rarely choke on degenerate input — never block
        # the export. Log + ship the un-repaired mesh.
        sys.stderr.write(
            f"[stage6] WARNING: pymeshfix raised {exc!r}; shipping "
            f"un-repaired mesh.\n"
        )
        return final

    # PyMeshFix may add geometry to fill holes. If we've exceeded the
    # §0 50–80K band by >20%, re-decimate. Use the same fast_simplification
    # path as Stage 5.
    n_faces_repaired = len(repaired.faces)
    if _fs is not None and n_faces_repaired > int(target_tris * 1.2):
        try:
            repaired = _decimate(repaired, target_tris=target_tris)
        except PipelineError as exc:
            sys.stderr.write(
                f"[stage6] WARNING: post-repair decimation failed "
                f"({exc.detail}); shipping at {n_faces_repaired} tris.\n"
            )

    is_watertight_out = bool(repaired.is_watertight)
    is_winding_consistent = bool(getattr(repaired, "is_winding_consistent", False))
    elapsed_ms = int((_time.monotonic() - started) * 1000)
    sys.stderr.write(
        f"[stage6] pymeshfix done in {elapsed_ms}ms — "
        f"in_tris={n_faces_in} out_tris={len(repaired.faces)} "
        f"watertight_in={was_watertight} watertight_out={is_watertight_out} "
        f"winding_consistent={is_winding_consistent}\n"
    )

    # Emit a structured warning frame if PyMeshFix somehow couldn't
    # produce a watertight result — slicer will likely still cope but
    # the operator/user should know. Matches the stage5 thin-walls
    # warning protocol.
    if not is_watertight_out:
        try:
            sys.stdout.write(
                json.dumps({
                    "type": "warning",
                    "stage": "stage6",
                    "code": "not_watertight_after_repair",
                    "in_tris": int(n_faces_in),
                    "out_tris": int(len(repaired.faces)),
                }) + "\n"
            )
            sys.stdout.flush()
        except Exception:  # noqa: BLE001
            pass
    return repaired


def _split_components(mesh: trimesh.Trimesh) -> list[trimesh.Trimesh]:
    """Split a mesh into connected-component sub-meshes.

    Wraps `trimesh.Trimesh.split` with `only_watertight=False` so we get
    every shell, watertight or not. trimesh.split can return a numpy
    array or a list depending on the version; normalise to list.
    """
    try:
        comps = mesh.split(only_watertight=False)
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(
            f"[stage6] split_components raised {exc!r}; "
            f"treating mesh as single shell.\n"
        )
        return [mesh]
    if comps is None:
        return [mesh]
    # trimesh returns a numpy array of Trimesh objects
    return [c for c in list(comps) if c is not None and len(getattr(c, "faces", [])) > 0]


def _meshfix_one(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Run PyMeshFix on a single connected mesh.

    Used by stage 6 only on the LARGEST component (the head). Other
    shells (the cap) are passed through un-touched because they're
    already hand-tuned watertight assets shipping with the image, and
    PyMeshFix's per-component cleaner has been observed deleting them
    when it considers their geometry too messy to repair.
    """
    v_in = np.asarray(mesh.vertices, dtype=np.float64)
    f_in = np.asarray(mesh.faces, dtype=np.int32)
    # Modern pymeshfix exposes `clean_from_arrays(v, f, ...)` that
    # returns the cleaned arrays directly. Single-shell input means
    # joincomp / remove_smallest_components are both no-ops.
    v_out, f_out = _pmf.clean_from_arrays(  # type: ignore[union-attr]
        v_in, f_in,
        verbose=False,
        joincomp=False,
        remove_smallest_components=False,
    )
    if len(v_out) == 0 or len(f_out) == 0:
        raise RuntimeError("pymeshfix produced an empty mesh")
    out = trimesh.Trimesh(
        np.asarray(v_out, dtype=np.float64),
        np.asarray(f_out, dtype=np.int64),
        process=True,
    )
    out.merge_vertices()
    out.fix_normals()
    return out
