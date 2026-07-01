import { Suspense } from "react";
import LoginForm from "./LoginForm";
import { seedDemoAdminIfNeeded } from "@/app/setup/actions";

export default async function LoginPage() {
    await seedDemoAdminIfNeeded();

    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    );
}
