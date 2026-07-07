package com.timixa.backend.common;

public class ReminderNotFoundException extends RuntimeException {
    public ReminderNotFoundException() { super("Reminder not found"); }
}
