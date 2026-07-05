package com.timixa.backend.common;

public class HabitNotFoundException extends RuntimeException {
    public HabitNotFoundException() { super("Habit not found"); }
}
