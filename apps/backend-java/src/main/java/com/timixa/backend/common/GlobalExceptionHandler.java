package com.timixa.backend.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> fields = new HashMap<>();
        e.getBindingResult().getFieldErrors().forEach(fe ->
            fields.put(fe.getField(), fe.getDefaultMessage()));
        return ResponseEntity.badRequest()
            .body(ErrorResponse.of("VALIDATION_ERROR", "Invalid request", fields));
    }

    @ExceptionHandler(EmailTakenException.class)
    public ResponseEntity<ErrorResponse> handleEmailTaken(EmailTakenException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(ErrorResponse.of("EMAIL_TAKEN", e.getMessage()));
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleInvalidCreds(InvalidCredentialsException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(ErrorResponse.of("INVALID_CREDENTIALS", e.getMessage()));
    }

    @ExceptionHandler(OnboardingAlreadyCompleteException.class)
    public ResponseEntity<ErrorResponse> handleOnboardingDone(OnboardingAlreadyCompleteException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(ErrorResponse.of("ONBOARDING_ALREADY_COMPLETE", e.getMessage()));
    }

    @ExceptionHandler({AuthenticationException.class, BadCredentialsException.class})
    public ResponseEntity<ErrorResponse> handleAuth(AuthenticationException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(ErrorResponse.of("UNAUTHENTICATED", "Authentication required"));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(ErrorResponse.of("FORBIDDEN", "Access denied"));
    }

    @ExceptionHandler(TaskNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleTaskNotFound(TaskNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse.of("TASK_NOT_FOUND", e.getMessage()));
    }

    @ExceptionHandler(TaskAlreadyCompleteException.class)
    public ResponseEntity<ErrorResponse> handleTaskAlreadyComplete(TaskAlreadyCompleteException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(ErrorResponse.of("TASK_ALREADY_COMPLETE", e.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException e) {
        return ResponseEntity.badRequest()
            .body(ErrorResponse.of("VALIDATION_ERROR", e.getMessage()));
    }

    @ExceptionHandler(ExceptionNotAllowedException.class)
    public ResponseEntity<ErrorResponse> handleExceptionNotAllowed(ExceptionNotAllowedException e) {
        return ResponseEntity.badRequest()
            .body(ErrorResponse.of("EXCEPTION_NOT_ALLOWED", e.getMessage()));
    }

    @ExceptionHandler(ExceptionAlreadyExistsException.class)
    public ResponseEntity<ErrorResponse> handleExceptionAlreadyExists(ExceptionAlreadyExistsException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(ErrorResponse.of("EXCEPTION_ALREADY_EXISTS", e.getMessage()));
    }

    @ExceptionHandler(SegmentOverlapException.class)
    public ResponseEntity<ErrorResponse> handleSegmentOverlap(SegmentOverlapException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(ErrorResponse.of("SEGMENT_OVERLAP", e.getMessage()));
    }

    @ExceptionHandler(SegmentNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleSegmentNotFound(SegmentNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse.of("SEGMENT_NOT_FOUND", e.getMessage()));
    }

    @ExceptionHandler(HabitNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleHabitNotFound(HabitNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse.of("HABIT_NOT_FOUND", e.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleAny(Exception e) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ErrorResponse.of("INTERNAL", "Internal server error"));
    }
}
