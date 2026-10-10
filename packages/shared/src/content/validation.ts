/** Validation messages shared by web forms and API responses (R10). Plain, no apology, say what to do. */
export const validation = {
  emailRequired: "Enter your email address.",
  emailInvalid: "Enter a valid email address, like name@example.com.",
  emailTooLong: "That email address is too long.",
  codeInvalid: "Enter the 6 digit code from your email.",
  nameRequired: "Enter your name.",
  nameTooLong: (max: number) => `Use ${max} characters or fewer.`,
  usernameInvalid: "Use 3 to 20 letters, numbers or underscores, all lowercase.",
  usernameReserved: "That username is not available. Try another one.",
  ageRequired: "Confirm that you are 18 or older to continue.",
  termsRequired: "Accept the Terms and the Privacy Policy to continue.",
  searchTooShort: (min: number) => `Type at least ${min} characters to search.`,
} as const;
