import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isCloud } from "@/core/edition";
import LoginForm from "./LoginForm";

interface LoginPageProps {
    searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const { next } = await searchParams;

    // Cloud edition delegates auth to the ecosystem auth host (ADR-0003).
    // Local edition keeps the inline NextAuth Credentials form.
    if (isCloud) {
        const authHost = process.env.NEXT_PUBLIC_AUTH_HOST_URL;
        if (authHost) {
            const url = new URL("/login", authHost);
            if (next) url.searchParams.set("next", next);
            redirect(url.toString());
        }
    }

    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    );
}
