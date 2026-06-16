package com.timixa.backend.common;

public class ExceptionAlreadyExistsException extends RuntimeException {
    public ExceptionAlreadyExistsException() { super("Exception already exists for that date"); }
}
