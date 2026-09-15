export default async function LockedPage({
    searchParams,
}: {
    searchParams: Promise<{ reason?: string }>;
}) {
    const { reason } = await searchParams;

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "100vh",
                padding: "2rem",
                textAlign: "center",
            }}
        >
            <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
                Workspace Locked
            </h1>
            <p style={{ color: "#666", maxWidth: "400px" }}>
                {reason ||
                    "This workspace is locked. Contact the workspace owner."}
            </p>
        </div>
    );
}
