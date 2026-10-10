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
  messageRequired: "Type a message first.",
  messageTooLong: (max: number) => `Messages can be up to ${max} characters.`,
  contactMessageShort: "Tell us a little more, at least 10 characters.",
  contactMessageLong: (max: number) => `Keep it to ${max} characters or fewer.`,
  searchTooShort: (min: number) => `Type at least ${min} characters to search.`,
} as const;

/** Password messages. They say what to change, not what is wrong with the person. */
export const passwordMessages = {
  required: "Enter a password.",
  loginRequired: "Enter your password.",
  TOO_SHORT: "Use at least 8 characters.",
  TOO_LONG: "Use 128 characters or fewer.",
  COMMON: "That password is too easy to guess. Try a longer one.",
  SAME_AS_EMAIL: "Do not use your email address as your password.",
  SAME_AS_NAME: "Do not use your name as your password.",
  ONE_CHARACTER: "Use more than one kind of character.",
  mismatch: "The two passwords do not match.",
} as const;
