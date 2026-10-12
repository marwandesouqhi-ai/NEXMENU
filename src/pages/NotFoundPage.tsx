import { Link } from "react-router";
import { ErrorState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
export default function NotFoundPage() { return <main className="grid min-h-screen place-items-center p-6"><div><ErrorState title="Page not found" body="The page you’re looking for does not exist." /><Link to="/" className="block text-center"><Button>Back to NEXMENU</Button></Link></div></main>; }
