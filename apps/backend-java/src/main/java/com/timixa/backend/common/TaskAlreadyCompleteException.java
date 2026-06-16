package com.timixa.backend.common;
public class TaskAlreadyCompleteException extends RuntimeException {
    public TaskAlreadyCompleteException() { super("Task already complete for that date"); }
}
