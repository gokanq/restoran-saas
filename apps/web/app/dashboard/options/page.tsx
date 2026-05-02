import { redirect } from 'next/navigation';

export default function DashboardOptionsRedirectPage() {
  redirect('/dashboard/menu');
}
