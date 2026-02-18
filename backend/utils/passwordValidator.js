/**
 * Validates password strength
 * Criteria:
 * - At least 8 characters long
 * - Contains at least one uppercase letter
 * - Contains at least one lowercase letter
 * - Contains at least one number
 * - Contains at least one special character (@$!%*?& etc.)
 */
export function validatePassword(password) {
    if (!password) {
        return { isValid: false, message: 'Password is required.' };
    }

    if (password.length < 8) {
        return { isValid: false, message: 'Password must be at least 8 characters long.' };
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
        return {
            isValid: false,
            message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
        };
    }

    return { isValid: true };
}
