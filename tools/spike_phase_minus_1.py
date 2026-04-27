"""Phase -1 spike: validate design assumptions for the 3D pipeline.

Run from repo root:
    python3 tools/spike_phase_minus_1.py
"""
import sys
import os
import json
import math

sys.path.insert(0, os.path.expanduser('~/Library/Python/3.9/lib/python/site-packages'))

import numpy as np
import trimesh
import manifold3d as m3

REPO = "/Users/ianroy/Library/CloudStorage/Dropbox/Sadys Bikes/App/Untitled/bikeheadz"
PATHS = {
    "ian_head": f"{REPO}/server/assets/reference/ian_head.stl",
    "nik_head": f"{REPO}/server/assets/reference/nik_head.stl",
    "valve_cap": f"{REPO}/server/assets/valve_cap.stl",
    "negative_core": f"{REPO}/server/assets/negative_core.stl",
}

OUTPUT = {}


def describe_mesh(name, mesh):
    extents = mesh.extents.tolist()
    bbox = mesh.bounds.tolist()
    try:
        signed_vol = float(mesh.volume)
    except Exception:
        signed_vol = float("nan")
    try:
        bodies = int(mesh.body_count)
    except Exception:
        bodies = -1
    try:
        euler = int(mesh.euler_number)
    except Exception:
        euler = -9999
    return {
        "name": name,
        "triangles": int(len(mesh.faces)),
        "vertices": int(len(mesh.vertices)),
        "is_watertight": bool(mesh.is_watertight),
        "is_winding_consistent": bool(mesh.is_winding_consistent),
        "is_volume": bool(mesh.is_volume),
        "euler_number": euler,
        "body_count": bodies,
        "volume_mm3": signed_vol,
        "extents_xyz": extents,
        "bbox_min": bbox[0],
        "bbox_max": bbox[1],
        "centroid": mesh.centroid.tolist(),
        "bbox_center": ((np.array(bbox[0]) + np.array(bbox[1])) / 2.0).tolist(),
    }


def load_meshes():
    return {k: trimesh.load(p, force="mesh") for k, p in PATHS.items()}


def to_manifold(mesh):
    verts = np.asarray(mesh.vertices, dtype=np.float32)
    faces = np.asarray(mesh.faces, dtype=np.uint32)
    return m3.Manifold(m3.Mesh(verts, faces))


def manifold_to_trimesh(man):
    mesh = man.to_mesh()
    # m3.Mesh exposes .vert_properties (Nx3 floats) and .tri_verts (Mx3 uint)
    verts = np.asarray(mesh.vert_properties)[:, :3]
    faces = np.asarray(mesh.tri_verts)
    return trimesh.Trimesh(vertices=verts, faces=faces, process=False)


def hausdorff_stats(mesh_a, mesh_b, n_samples=50000):
    """Sample points on a, find nearest on b, return stats. Symmetric: a→b and b→a."""
    pts_a, _ = trimesh.sample.sample_surface(mesh_a, n_samples)
    pts_b, _ = trimesh.sample.sample_surface(mesh_b, n_samples)
    _, da, _ = trimesh.proximity.closest_point(mesh_b, pts_a)
    _, db, _ = trimesh.proximity.closest_point(mesh_a, pts_b)
    d = np.concatenate([da, db])
    return {
        "mean_mm": float(np.mean(d)),
        "max_mm": float(np.max(d)),
        "p95_mm": float(np.percentile(d, 95)),
        "p99_mm": float(np.percentile(d, 99)),
    }


def bottom_slab_circularity(mesh, slab_height=2.0):
    """Slice the bottom slab of the mesh and inspect the cross section.
    Return the convex-hull circularity of the projection (1.0 = perfect disc)
    AND check whether there's a hole near the centre.
    """
    z_min = mesh.bounds[0, 2]
    slab_z = float(z_min + slab_height * 0.5)
    try:
        section = mesh.section(plane_origin=[0, 0, slab_z], plane_normal=[0, 0, 1])
    except Exception as e:
        return {"slab_z_centre": slab_z, "found_section": False, "error": str(e)}
    if section is None:
        return {"slab_z_centre": slab_z, "found_section": False}
    try:
        section_2d, _ = section.to_2D()
    except Exception as e:
        return {"slab_z_centre": slab_z, "found_section": False, "error": str(e)}
    if section_2d is None:
        return {"slab_z_centre": slab_z, "found_section": False}
    try:
        polys = section_2d.polygons_full
    except Exception as e:
        return {"slab_z_centre": slab_z, "found_section": False, "error": str(e)}
    if polys is None or len(polys) == 0:
        return {"slab_z_centre": slab_z, "found_section": False, "polys": 0}
    polys_sorted = sorted(polys, key=lambda p: p.area, reverse=True)
    outer = polys_sorted[0]
    outer_area = outer.area
    outer_perim = outer.length
    circ = (4.0 * math.pi * outer_area) / (outer_perim ** 2) if outer_perim > 0 else 0.0
    holes = list(outer.interiors)
    hole_count = len(holes)
    from shapely.geometry import Polygon as ShPoly
    hole_metrics = []
    for h in holes:
        hp = ShPoly(h)
        hole_metrics.append({
            "area_mm2": float(hp.area),
            "perimeter_mm": float(hp.length),
            "circularity": float((4.0 * math.pi * hp.area) / (hp.length ** 2)) if hp.length > 0 else 0.0,
        })
    return {
        "slab_z_centre": slab_z,
        "outer_area_mm2": float(outer_area),
        "outer_perim_mm": float(outer_perim),
        "outer_circularity": float(circ),
        "hole_count": int(hole_count),
        "holes": hole_metrics,
    }


def cap_region_metrics(ref_mesh, head_mesh):
    """Compare bottom plane of ref to head_only to extract cap metrics."""
    ref_z_min = float(ref_mesh.bounds[0, 2])
    head_z_min = float(head_mesh.bounds[0, 2])
    cap_z_top = head_z_min  # plane where carved socket starts
    cap_z_bot = ref_z_min   # bottommost point of the original (likely cap bottom)
    return {
        "ref_z_min": ref_z_min,
        "head_only_z_min": head_z_min,
        "z_offset_head_minus_ref": head_z_min - ref_z_min,
    }


def cap_region_z_range(ref_mesh, head_mesh):
    """Z range that contains cap geometry on a reference: from ref bottom up to head_only bottom."""
    ref_z_min = float(ref_mesh.bounds[0, 2])
    head_z_min = float(head_mesh.bounds[0, 2])
    return {"z_min": ref_z_min, "z_max": head_z_min, "height_mm": head_z_min - ref_z_min}


def cap_region_max_xy_radius(ref_mesh, z_max):
    """Max XY radius of the geometry below z_max (the cap region)."""
    verts = np.asarray(ref_mesh.vertices)
    mask = verts[:, 2] <= z_max
    cap_verts = verts[mask]
    if len(cap_verts) == 0:
        return {"max_radius_mm": 0.0, "cx": 0.0, "cy": 0.0}
    cx = float((np.min(cap_verts[:, 0]) + np.max(cap_verts[:, 0])) / 2.0)
    cy = float((np.min(cap_verts[:, 1]) + np.max(cap_verts[:, 1])) / 2.0)
    radii = np.linalg.norm(cap_verts[:, :2] - np.array([cx, cy]), axis=1)
    return {"max_radius_mm": float(np.max(radii)),
            "p99_radius_mm": float(np.percentile(radii, 99)),
            "centre_xy": [cx, cy]}


# ---------- main ----------
def main():
    print("Loading meshes...")
    meshes = load_meshes()

    print("\n== Task 1: describe inputs ==")
    OUTPUT["task1_inputs"] = {k: describe_mesh(k, v) for k, v in meshes.items()}
    for k, info in OUTPUT["task1_inputs"].items():
        print(f"{k}: tris={info['triangles']}, watertight={info['is_watertight']}, "
              f"vol={info['volume_mm3']:.1f} mm^3, extents={info['extents_xyz']}")

    ian_ext = np.array(OUTPUT["task1_inputs"]["ian_head"]["extents_xyz"])
    nik_ext = np.array(OUTPUT["task1_inputs"]["nik_head"]["extents_xyz"])
    OUTPUT["task1_head_compare"] = {
        "ian_extents": ian_ext.tolist(),
        "nik_extents": nik_ext.tolist(),
        "abs_diff_mm": (ian_ext - nik_ext).tolist(),
        "ratio": (ian_ext / nik_ext).tolist(),
        "max_abs_diff_mm": float(np.max(np.abs(ian_ext - nik_ext))),
    }
    print("ian vs nik max bbox diff (mm):", OUTPUT["task1_head_compare"]["max_abs_diff_mm"])

    print("\n== Task 2: reverse boolean (ref - cap) ==")
    cap_man = to_manifold(meshes["valve_cap"])
    head_only_meshes = {}
    OUTPUT["task2_reverse_bool"] = {}
    for name in ["ian_head", "nik_head"]:
        ref = meshes[name]
        ref_man = to_manifold(ref)
        head_man = ref_man - cap_man
        head_tm = manifold_to_trimesh(head_man)
        head_only_meshes[name] = head_tm
        bottom = bottom_slab_circularity(head_tm, slab_height=2.0)
        cap_info = cap_region_metrics(ref, head_tm)
        OUTPUT["task2_reverse_bool"][name] = {
            "head_only": describe_mesh(f"{name}_head_only", head_tm),
            "cap_carve_metrics": cap_info,
            "bottom_slab": bottom,
        }
        print(f"{name} head_only: tris={len(head_tm.faces)}, "
              f"watertight={head_tm.is_watertight}, "
              f"bottom_slab_circ={bottom.get('outer_circularity', 'n/a')}, "
              f"holes={bottom.get('hole_count', 'n/a')}")

    print("\n== Task 3: forward boolean union, Hausdorff vs ref ==")
    OUTPUT["task3_forward_bool"] = {}
    for name in ["ian_head", "nik_head"]:
        ref = meshes[name]
        head_tm = head_only_meshes[name]
        head_man = to_manifold(head_tm)
        recombined_man = head_man + cap_man
        recombined_tm = manifold_to_trimesh(recombined_man)
        h = hausdorff_stats(ref, recombined_tm, n_samples=20000)
        OUTPUT["task3_forward_bool"][name] = {
            "recombined": describe_mesh(f"{name}_recombined", recombined_tm),
            "hausdorff_vs_ref": h,
        }
        print(f"{name} recombined Hausdorff vs ref: mean={h['mean_mm']:.4f} mm, "
              f"max={h['max_mm']:.4f} mm, p95={h['p95_mm']:.4f} mm")

    print("\n== Task 4: origin alignment cap vs negative_core ==")
    cap_centre = np.array(OUTPUT["task1_inputs"]["valve_cap"]["bbox_center"])
    neg_centre = np.array(OUTPUT["task1_inputs"]["negative_core"]["bbox_center"])
    xy_offset = cap_centre[:2] - neg_centre[:2]
    z_offset = cap_centre[2] - neg_centre[2]
    OUTPUT["task4_origin_alignment"] = {
        "valve_cap_bbox_center": cap_centre.tolist(),
        "negative_core_bbox_center": neg_centre.tolist(),
        "xy_offset_mm": xy_offset.tolist(),
        "xy_offset_magnitude_mm": float(np.linalg.norm(xy_offset)),
        "z_offset_mm": float(z_offset),
        "aligned_within_0p5mm": bool(np.linalg.norm(xy_offset) < 0.5),
    }
    print(f"cap centre = {cap_centre}, neg centre = {neg_centre}")
    print(f"xy offset magnitude = {np.linalg.norm(xy_offset):.4f} mm, z offset = {z_offset:.4f} mm")

    print("\n== Task 5: empirical calibration constants ==")
    head_heights = []
    cap_offsets = []
    cap_z_ranges = []
    cap_radii = []
    for name in ["ian_head", "nik_head"]:
        ref = meshes[name]
        head_tm = head_only_meshes[name]
        head_heights.append(head_tm.extents[2])
        cap_offsets.append(head_tm.bounds[0, 2] - ref.bounds[0, 2])
        cz = cap_region_z_range(ref, head_tm)
        cap_z_ranges.append(cz)
        rad = cap_region_max_xy_radius(ref, head_tm.bounds[0, 2])
        cap_radii.append(rad)

    target_head_height = float(np.mean(head_heights))
    valve_cap_offset = float(np.mean(cap_offsets))

    cap_mesh = meshes["valve_cap"]
    neg_mesh = meshes["negative_core"]
    valve_cap_outer_diam = float(max(cap_mesh.extents[0], cap_mesh.extents[1]))
    valve_cap_height = float(cap_mesh.extents[2])
    neg_diam = float(max(neg_mesh.extents[0], neg_mesh.extents[1]))
    neg_height = float(neg_mesh.extents[2])

    # Threaded-cylinder portion: slice the cap into Z bins and find the most common radius
    cap_verts = np.asarray(cap_mesh.vertices)
    cap_z_min = float(cap_mesh.bounds[0, 2])
    cap_z_max = float(cap_mesh.bounds[1, 2])
    z_bins = np.linspace(cap_z_min, cap_z_max, 21)
    radial_per_bin = []
    for i in range(20):
        mask = (cap_verts[:, 2] >= z_bins[i]) & (cap_verts[:, 2] < z_bins[i + 1])
        if mask.sum() < 5:
            continue
        cx = float((cap_verts[:, 0].min() + cap_verts[:, 0].max()) / 2.0)
        cy = float((cap_verts[:, 1].min() + cap_verts[:, 1].max()) / 2.0)
        rs = np.linalg.norm(cap_verts[mask, :2] - np.array([cx, cy]), axis=1)
        radial_per_bin.append({
            "z_lo": float(z_bins[i]),
            "z_hi": float(z_bins[i + 1]),
            "max_r": float(rs.max()),
            "median_r": float(np.median(rs)),
            "p99_r": float(np.percentile(rs, 99)),
        })

    # Threaded portion = the most common max_r value (lots of bins share it)
    if radial_per_bin:
        max_rs = np.array([b["max_r"] for b in radial_per_bin])
        # Cluster: take median as the threaded outer radius
        threaded_outer_radius = float(np.median(max_rs))
        threaded_outer_diam = 2.0 * threaded_outer_radius
        # Flange detection: any bin whose max_r exceeds the median by >5%
        flange_bins = [b for b in radial_per_bin if b["max_r"] > threaded_outer_radius * 1.05]
    else:
        threaded_outer_diam = valve_cap_outer_diam
        flange_bins = []

    neg_radius = neg_diam / 2.0
    cap_radius_for_clearance = threaded_outer_diam / 2.0
    clearance = neg_radius - cap_radius_for_clearance

    cap_region_z_min = float(np.mean([cz["z_min"] for cz in cap_z_ranges]))
    cap_region_z_max = float(np.mean([cz["z_max"] for cz in cap_z_ranges]))
    cap_region_height = float(np.mean([cz["height_mm"] for cz in cap_z_ranges]))
    cap_region_radius = float(np.mean([r["max_radius_mm"] for r in cap_radii]))

    constants = {
        "TARGET_HEAD_HEIGHT_MM": round(target_head_height, 4),
        "VALVE_CAP_OFFSET_FROM_HEAD_BOTTOM_MM": round(valve_cap_offset, 4),
        "NEGATIVE_CORE_DIAMETER_MM": round(neg_diam, 4),
        "NEGATIVE_CORE_HEIGHT_MM": round(neg_height, 4),
        "VALVE_CAP_OUTER_DIAMETER_MM_BBOX": round(valve_cap_outer_diam, 4),
        "VALVE_CAP_THREADED_OUTER_DIAMETER_MM": round(threaded_outer_diam, 4),
        "VALVE_CAP_HEIGHT_MM": round(valve_cap_height, 4),
        "NEGATIVE_CORE_CLEARANCE_MM": round(clearance, 4),
        "NEGATIVE_CORE_CLEARANCE_LOCKED_MM": 0.25,
        "CAP_REGION_Z_MIN_MM": round(cap_region_z_min, 4),
        "CAP_REGION_Z_MAX_MM": round(cap_region_z_max, 4),
        "CAP_REGION_HEIGHT_MM": round(cap_region_height, 4),
        "CAP_REGION_RADIUS_MM": round(cap_region_radius, 4),
    }
    OUTPUT["task5_calibration_constants"] = constants
    OUTPUT["task5_per_ref_detail"] = {
        "head_heights_mm": head_heights,
        "cap_offsets_mm": cap_offsets,
        "cap_z_ranges": cap_z_ranges,
        "cap_radii": cap_radii,
        "cap_radial_per_bin": radial_per_bin,
        "flange_bins": flange_bins,
    }
    print("Constants:")
    for k, v in constants.items():
        print(f"  {k}: {v}")

    # ---- Verdict ----
    print("\n== Verdict ==")
    bbox_match = OUTPUT["task1_head_compare"]["max_abs_diff_mm"] < 5.0
    boolean_clean = all(
        OUTPUT["task2_reverse_bool"][n]["head_only"]["is_watertight"]
        for n in ["ian_head", "nik_head"]
    )
    forward_close = all(
        OUTPUT["task3_forward_bool"][n]["hausdorff_vs_ref"]["max_mm"] < 0.5
        for n in ["ian_head", "nik_head"]
    )
    aligned = OUTPUT["task4_origin_alignment"]["aligned_within_0p5mm"]
    clearance_ok = abs(clearance - 0.25) < 0.05

    verdict_yes = bbox_match and boolean_clean and forward_close and aligned and clearance_ok

    OUTPUT["verdict"] = {
        "yes": bool(verdict_yes),
        "checks": {
            "bbox_match (<5 mm)": bool(bbox_match),
            "boolean_clean (head_only watertight)": bool(boolean_clean),
            "forward_close (recombined Hausdorff<0.5)": bool(forward_close),
            "cap/neg_core_aligned (<0.5 mm)": bool(aligned),
            "clearance_matches_locked (~0.25 mm)": bool(clearance_ok),
        },
    }
    print("Verdict:", "YES" if verdict_yes else "NO", OUTPUT["verdict"]["checks"])

    # Persist JSON for the report
    with open(f"{REPO}/tools/spike_results.json", "w") as f:
        json.dump(OUTPUT, f, indent=2)
    print(f"\nWrote {REPO}/tools/spike_results.json")


if __name__ == "__main__":
    main()
