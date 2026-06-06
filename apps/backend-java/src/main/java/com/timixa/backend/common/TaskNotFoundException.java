package com.timixa.backend.common;
public class TaskNotFoundException extends RuntimeException {
    public TaskNotFoundException() { super("Task not found"); }
}
