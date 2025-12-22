import { useEffect } from "react";
import { useRouter } from "next/router";
import { getCurrentUser } from "@/api";
import Head from "next/head";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await getCurrentUser();
        router.replace("/dashboard");
      } catch (error) {
        router.replace("/login");
      }
    };
    checkAuth();
  }, [router]);

  return (
    <>
      <Head>
        <title>Optiverifi - Customer Dashboard</title>
      </Head>
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
      </div>
    </>
  );
}

