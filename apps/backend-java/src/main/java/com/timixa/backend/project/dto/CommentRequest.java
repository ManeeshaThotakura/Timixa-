package com.timixa.backend.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Create or edit a comment; the author is the authenticated user. */
public record CommentRequest(
    @NotBlank @Size(max = 4000) String text
) {}
