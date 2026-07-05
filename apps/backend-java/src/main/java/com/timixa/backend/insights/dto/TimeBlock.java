package com.timixa.backend.insights.dto;

public record TimeBlock(
    String label,
    double hours,
    String color
) {}
