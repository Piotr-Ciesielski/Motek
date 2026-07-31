async function deleteSupabaseAccount({ session, password, authClient, adminClient }) {
  const userId = session?.user?.id;
  const email = session?.user?.email;

  if (!userId || !email || !authClient?.auth || !adminClient?.auth?.admin) {
    throw new Error("Nie udało się potwierdzić hasła.");
  }

  let verification;
  try {
    verification = await authClient.auth.signInWithPassword({ email, password });
  } catch {
    throw new Error("Nie udało się potwierdzić hasła.");
  }

  if (
    verification?.error ||
    !verification.data?.user ||
    verification.data.user.id !== userId
  ) {
    throw new Error("Nie udało się potwierdzić hasła.");
  }

  const deletion = await adminClient.auth.admin.deleteUser(userId);
  if (deletion?.error) {
    throw new Error("Nie udało się usunąć konta.");
  }
}

module.exports = {
  deleteSupabaseAccount,
};
