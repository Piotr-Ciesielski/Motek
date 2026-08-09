const { randomUUID } = require("node:crypto");

const PUBLIC_REGISTRATION_ERROR = "Nie udało się ukończyć rejestracji.";

function normalizeEmail(value) {
  if (typeof value !== "string") throw new Error(PUBLIC_REGISTRATION_ERROR);
  const email = value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(PUBLIC_REGISTRATION_ERROR);
  }
  return email;
}

function getRpcError(result) {
  return result && result.error ? result.error : null;
}

async function callServiceRpc(serviceClient, name, parameters) {
  const result = await serviceClient.rpc(name, parameters);
  const error = getRpcError(result);
  if (error) throw error;
  return result?.data;
}

function getDeleteUser(adminClient) {
  const deleteUser = adminClient?.auth?.admin?.deleteUser || adminClient?.deleteUser;
  if (typeof deleteUser !== "function") throw new Error("Brak operacji usuwania użytkownika.");
  return deleteUser.bind(adminClient?.auth?.admin || adminClient);
}

async function registerInvitedUser(
  { email, password, invitationToken, termsVersion, privacyVersion, captchaToken, emailRedirectTo },
  { authClient, adminClient, serviceClient, legalDocument, hashInvitationToken },
) {
  const normalizedEmail = normalizeEmail(email);
  if (typeof password !== "string" || !password) throw new Error(PUBLIC_REGISTRATION_ERROR);
  if (!legalDocument || termsVersion !== legalDocument.termsVersion
      || privacyVersion !== legalDocument.privacyVersion) {
    throw new Error(PUBLIC_REGISTRATION_ERROR);
  }
  if (typeof hashInvitationToken !== "function") throw new Error(PUBLIC_REGISTRATION_ERROR);

  const reservationId = randomUUID();
  const tokenHash = await hashInvitationToken(invitationToken);
  if (typeof tokenHash !== "string" || !/^[0-9a-f]{64}$/.test(tokenHash)) {
    throw new Error(PUBLIC_REGISTRATION_ERROR);
  }

  let userId = null;
  let reservationCreated = false;

  try {
    await callServiceRpc(serviceClient, "reserve_registration_invitation", {
      p_token_hash: tokenHash,
      p_email: normalizedEmail,
      p_terms_version: termsVersion,
      p_reservation_id: reservationId,
    });
    reservationCreated = true;

    const signUpResult = await authClient.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { login: normalizedEmail },
        ...(captchaToken ? { captchaToken } : {}),
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    });
    if (signUpResult?.error || !signUpResult?.data?.user?.id) {
      throw signUpResult?.error || new Error(PUBLIC_REGISTRATION_ERROR);
    }

    userId = signUpResult.data.user.id;
    await callServiceRpc(serviceClient, "attach_registration_user", {
      p_reservation_id: reservationId,
      p_user_id: userId,
    });
    await callServiceRpc(serviceClient, "finalize_invited_registration", {
      p_reservation_id: reservationId,
      p_user_id: userId,
      p_terms_version: termsVersion,
      p_privacy_version: privacyVersion,
    });

    return {
      user: signUpResult.data.user,
      session: signUpResult.data.session || null,
    };
  } catch (error) {
    if (userId) {
      let deleted = false;
      try {
        const result = await getDeleteUser(adminClient)(userId);
        deleted = !result?.error;
      } catch {
        deleted = false;
      }
      if (deleted && reservationCreated) {
        try {
          await callServiceRpc(serviceClient, "release_registration_reservation", {
            p_reservation_id: reservationId,
          });
        } catch {
          // Do not expose cleanup details to the public registration response.
        }
      }
    }
    throw new Error(PUBLIC_REGISTRATION_ERROR, { cause: error });
  }
}

module.exports = {
  PUBLIC_REGISTRATION_ERROR,
  registerInvitedUser,
};
