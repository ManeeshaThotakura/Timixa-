package com.timixa.backend.task;

import com.timixa.backend.common.SegmentNotFoundException;
import com.timixa.backend.common.SegmentOverlapException;
import com.timixa.backend.common.TaskNotFoundException;
import com.timixa.backend.task.dto.PlannedTaskRequest;
import com.timixa.backend.task.dto.PlannedTaskSegmentRequest;
import com.timixa.backend.task.dto.PlannedTaskSegmentUpdateRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("dev")
class PlannedTaskSegmentServiceTest {

    @Autowired PlannedTaskService taskService;
    @Autowired PlannedTaskSegmentService segmentService;
    @Autowired PlannedTaskRepository tasks;
    @Autowired PlannedTaskSegmentRepository segments;
    @Autowired PlannedTaskExceptionRepository exceptions;
    @Autowired PlannedTaskCompletionRepository completions;

    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void clean() {
        segments.deleteAll();
        exceptions.deleteAll();
        completions.deleteAll();
        tasks.deleteAll();
    }

    @Test
    void create_segment_ok() {
        UUID taskId = createDaily();
        var seg = segmentService.createSegment(userId, taskId,
            new PlannedTaskSegmentRequest(LocalDate.now(), "09:00", "10:00"));
        assertThat(seg.getId()).isNotNull();
        assertThat(seg.getStartTime()).isEqualTo("09:00");
        assertThat(seg.getEndTime()).isEqualTo("10:00");
        assertThat(segments.findByTaskIdAndSegmentDate(taskId, LocalDate.now())).hasSize(1);
    }

    @Test
    void create_segment_rejects_end_before_start() {
        UUID taskId = createDaily();
        assertThatThrownBy(() -> segmentService.createSegment(userId, taskId,
            new PlannedTaskSegmentRequest(LocalDate.now(), "10:00", "09:00")))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void create_segment_rejects_overlap_same_date() {
        UUID taskId = createDaily();
        segmentService.createSegment(userId, taskId,
            new PlannedTaskSegmentRequest(LocalDate.now(), "09:00", "10:00"));
        assertThatThrownBy(() -> segmentService.createSegment(userId, taskId,
            new PlannedTaskSegmentRequest(LocalDate.now(), "09:30", "10:30")))
            .isInstanceOf(SegmentOverlapException.class);
    }

    @Test
    void create_segment_allows_adjacent_on_same_date() {
        UUID taskId = createDaily();
        segmentService.createSegment(userId, taskId,
            new PlannedTaskSegmentRequest(LocalDate.now(), "09:00", "10:00"));
        // Adjacent end == start of next is NOT overlap.
        var seg2 = segmentService.createSegment(userId, taskId,
            new PlannedTaskSegmentRequest(LocalDate.now(), "10:00", "11:00"));
        assertThat(seg2.getId()).isNotNull();
        assertThat(segments.findByTaskIdAndSegmentDate(taskId, LocalDate.now())).hasSize(2);
    }

    @Test
    void create_segment_404_when_task_not_owned() {
        UUID taskId = createDaily();
        assertThatThrownBy(() -> segmentService.createSegment(UUID.randomUUID(), taskId,
            new PlannedTaskSegmentRequest(LocalDate.now(), "09:00", "10:00")))
            .isInstanceOf(TaskNotFoundException.class);
    }

    @Test
    void update_segment_changes_end_time() {
        UUID taskId = createDaily();
        var seg = segmentService.createSegment(userId, taskId,
            new PlannedTaskSegmentRequest(LocalDate.now(), "09:00", "10:00"));
        var updated = segmentService.updateSegment(userId, taskId, seg.getId(),
            new PlannedTaskSegmentUpdateRequest(null, "10:30"));
        assertThat(updated.getEndTime()).isEqualTo("10:30");
        assertThat(updated.getStartTime()).isEqualTo("09:00");
    }

    @Test
    void update_segment_rejects_overlap_with_other() {
        UUID taskId = createDaily();
        segmentService.createSegment(userId, taskId,
            new PlannedTaskSegmentRequest(LocalDate.now(), "09:00", "10:00"));
        var seg2 = segmentService.createSegment(userId, taskId,
            new PlannedTaskSegmentRequest(LocalDate.now(), "11:00", "12:00"));
        assertThatThrownBy(() -> segmentService.updateSegment(userId, taskId, seg2.getId(),
            new PlannedTaskSegmentUpdateRequest("09:30", null)))
            .isInstanceOf(SegmentOverlapException.class);
    }

    @Test
    void update_segment_404_when_segment_not_in_task() {
        UUID taskId = createDaily();
        var seg = segmentService.createSegment(userId, taskId,
            new PlannedTaskSegmentRequest(LocalDate.now(), "09:00", "10:00"));
        UUID otherTaskId = createDaily();
        assertThatThrownBy(() -> segmentService.updateSegment(userId, otherTaskId, seg.getId(),
            new PlannedTaskSegmentUpdateRequest(null, "10:30")))
            .isInstanceOf(SegmentNotFoundException.class);
    }

    @Test
    void delete_segment_removes_row() {
        UUID taskId = createDaily();
        var seg = segmentService.createSegment(userId, taskId,
            new PlannedTaskSegmentRequest(LocalDate.now(), "09:00", "10:00"));
        segmentService.deleteSegment(userId, taskId, seg.getId());
        assertThat(segments.findByTaskIdAndSegmentDate(taskId, LocalDate.now())).isEmpty();
    }

    @Test
    void delete_task_cascades_segments() {
        UUID taskId = createDaily();
        segmentService.createSegment(userId, taskId,
            new PlannedTaskSegmentRequest(LocalDate.now(), "09:00", "10:00"));
        taskService.delete(userId, taskId);
        assertThat(segments.findByTaskIdIn(List.of(taskId))).isEmpty();
    }

    @Test
    void findForDate_includes_segments_when_present() {
        UUID taskId = createDaily();
        segmentService.createSegment(userId, taskId,
            new PlannedTaskSegmentRequest(LocalDate.now(), "14:00", "14:30"));
        var out = taskService.findForDate(userId, LocalDate.now());
        assertThat(out).hasSize(1);
        assertThat(out.get(0).segmentsForDate()).hasSize(1);
        assertThat(out.get(0).segmentsForDate().get(0).startTime()).isEqualTo("14:00");
    }

    private UUID createDaily() {
        return taskService.create(userId, new PlannedTaskRequest(
            "Task", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            null, null, null, null)).id();
    }
}
