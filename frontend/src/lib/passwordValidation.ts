/**
 * Validates password strength
 */
export interface PasswordValidationResult {
    isValid: boolean;
    score: number; // 0-4
    requirements: {
        length: boolean;
        upper: boolean;
        lower: boolean;
        number: boolean;
        special: boolean;
    };
    message?: string;
}

export const validatePassword = (password: string): PasswordValidationResult => {
    const requirements = {
        length: password.length >= 8,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    const score = Object.values(requirements).filter(Boolean).length - 1; // score adjusted to match common 0-4 systems if length is met
    const actualScore = Math.max(0, Object.values(requirements).filter(Boolean).length - 1);

    const isValid = requirements.length && requirements.upper && requirements.lower && requirements.number && requirements.special;

    let message = '';
    if (!requirements.length) message = 'At least 8 characters required';
    else if (!requirements.upper) message = 'Add an uppercase letter';
    else if (!requirements.lower) message = 'Add a lowercase letter';
    else if (!requirements.number) message = 'Add a number';
    else if (!requirements.special) message = 'Add a special character';

    return {
        isValid,
        score: isValid ? 4 : actualScore,
        requirements,
        message: isValid ? 'Strong password' : message
    };
};
