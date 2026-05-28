"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

interface LoginResult {
    success: boolean;
    error?: string;
}

export async function loginAction(formData: FormData): Promise<LoginResult> {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
        await signIn("credentials", {
            email,
            password,
            redirect: false,
        });
        return { success: true };
    } catch (error) {
        if (error instanceof AuthError) {
            return {
                success: false,
                error: error.type === "CredentialsSignin"
                    ? "Invalid email or password."
                    : "Something went wrong.",
            };
        }
        throw error;
    }
}
