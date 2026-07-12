package com.timixa.backend.common;

/** Thrown when a requested entity does not exist or is not owned by the caller. */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
