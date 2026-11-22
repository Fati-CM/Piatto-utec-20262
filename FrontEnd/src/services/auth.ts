import {
  signUp,
  confirmSignUp,
  resendSignUpCode,
  signIn,
  signOut,
  getCurrentUser,
  fetchUserAttributes,
  fetchAuthSession,
  resetPassword,
  confirmResetPassword,
} from 'aws-amplify/auth';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function registerUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  return signUp({
    username: normalizeEmail(input.email),
    password: input.password,
    options: {
      userAttributes: {
        email: normalizeEmail(input.email),
        given_name: input.firstName.trim(),
        family_name: input.lastName.trim(),
      },
    },
  });
}

export async function verifyEmail(email: string, code: string) {
  return confirmSignUp({
    username: normalizeEmail(email),
    confirmationCode: code.trim(),
  });
}

export async function resendVerificationCode(email: string) {
  return resendSignUpCode({
    username: normalizeEmail(email),
  });
}

export async function loginUser(email: string, password: string) {
  return signIn({
    username: normalizeEmail(email),
    password,
  });
}

export async function readCurrentAccount() {
  const user = await getCurrentUser();
  const attributes = await fetchUserAttributes();
  const session = await fetchAuthSession();

  const claim = session.tokens?.accessToken.payload['cognito:groups'];
  const groups = Array.isArray(claim)
    ? claim.filter((value): value is string => typeof value === 'string')
    : [];

  return {
    userId: user.userId,
    email: attributes.email ?? '',
    firstName: attributes.given_name ?? '',
    lastName: attributes.family_name ?? '',
    groups,
    role: groups.includes('staff')
      ? 'staff'
      : groups.includes('customer')
        ? 'customer'
        : 'pending',
  };
}

export async function logoutUser() {
  await signOut();
}

export async function requestPasswordReset(email: string) {
  return resetPassword({
    username: normalizeEmail(email),
  });
}

export async function finishPasswordReset(
  email: string,
  code: string,
  newPassword: string,
) {
  return confirmResetPassword({
    username: normalizeEmail(email),
    confirmationCode: code.trim(),
    newPassword,
  });
}
