package com.timixa.backend.common;
public class SegmentNotFoundException extends RuntimeException {
    public SegmentNotFoundException() { super("Segment not found"); }
}
