import { createBrowserRouter } from "react-router";
import { Root } from "./Root";
import { HomePage } from "./components/HomePage";
import { HowItWorksPage } from "./components/HowItWorksPage";
import { AccountPage } from "./components/AccountPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: HomePage },
      { path: "how-it-works", Component: HowItWorksPage },
      { path: "account", Component: AccountPage },
    ],
  },
]);
