import { RouterProvider } from "react-router";
import Providers from "./Providers";
import { router } from "./routes";
export default function App() { return <Providers><RouterProvider router={router} /></Providers>; }
