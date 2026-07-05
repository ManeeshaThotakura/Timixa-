package com.timixa.backend.common;
public class SegmentOverlapException extends RuntimeException {
    public SegmentOverlapException() { super("Segment overlaps an existing segment on the same date"); }
}
