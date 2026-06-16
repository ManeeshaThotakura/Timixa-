package com.timixa.backend.common;
public class EmailTakenException extends RuntimeException {
    public EmailTakenException() { super("Email already in use"); }
}
