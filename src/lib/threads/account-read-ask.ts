/**
 * The account read's message in the chat. The read takes no input, so the thread says what was
 * asked by the action's own name: the route stores these words with the read (`/api/account-read`)
 * and the composer draws them on the live turn, so live and history read the same.
 */
export const ACCOUNT_READ_ASK = "Read my account";
