package com.timixa.backend.common;
public class OnboardingAlreadyCompleteException extends RuntimeException {
    public OnboardingAlreadyCompleteException() { super("Onboarding already complete"); }
}
