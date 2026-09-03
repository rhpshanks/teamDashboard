import Dashboard from "@/components/Dashboard";
import { loadDashboardData } from "@/lib/data";

/* Data is read from /data at build time; pushing a JSON change to GitHub
   triggers a Vercel rebuild, which is what makes the board "live". */
export default function Page() {
  return <Dashboard data={loadDashboardData()} />;
}
