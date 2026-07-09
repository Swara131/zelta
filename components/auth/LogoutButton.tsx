"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut, AuthError } from "@/lib/auth/actions";
import Button from "@/components/ui/Button";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut();
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error(err instanceof AuthError ? err.message : "Sign out failed.");
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      icon={LogOut}
      onClick={handleLogout}
      loading={loading}
      aria-label="Sign out"
      className="hidden shrink-0 md:inline-flex"
    >
      Sign out
    </Button>
  );
}
