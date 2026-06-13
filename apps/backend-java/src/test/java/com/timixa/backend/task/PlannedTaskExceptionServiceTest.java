package com.timixa.backend.task;

import com.timixa.backend.common.ExceptionAlreadyExistsException;
import com.timixa.backend.common.ExceptionNotAllowedException;
import com.timixa.backend.common.TaskNotFoundException;
import com.timixa.backend.task.dto.PlannedTaskExceptionRequest;
import com.timixa.backend.task.dto.PlannedTaskRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("dev")
class PlannedTaskExceptionServiceTest {

    @Autowired PlannedTaskService taskService;
    @Autowired PlannedTaskExceptionService exService;
    @Autowired PlannedTaskRepository tasks;
    @Autowired PlannedTaskExceptionRepository exceptions;
    @Autowired PlannedTaskCompletionRepository completions;

    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void clean() {
        exceptions.deleteAll();
        completions.deleteAll();
        tasks.deleteAll();
    }

    @Test
    void weekly_add_on_uncovered_date_ok() {
        UUID id = createWeekly(Set.of(DayOfWeek.MONDAY));
        LocalDate tue = mostRecent(DayOfWeek.TUESDAY);
        exService.addException(userId, id, new PlannedTaskExceptionRequest(tue, ExceptionType.ADD));
        assertThat(exceptions.findByTaskIdIn(List.of(id))).hasSize(1);
    }

    @Test
    void weekly_skip_on_covered_date_ok() {
        UUID id = createWeekly(Set.of(DayOfWeek.MONDAY));
        LocalDate mon = mostRecent(DayOfWeek.MONDAY);
        exService.addException(userId, id, new PlannedTaskExceptionRequest(mon, ExceptionType.SKIP));
        assertThat(exceptions.findByTaskIdIn(List.of(id))).hasSize(1);
    }

    @Test
    void once_any_exception_rejected() {
        UUID id = createOnce(LocalDate.now());
        assertThatThrownBy(() ->
            exService.addException(userId, id, new PlannedTaskExceptionRequest(LocalDate.now(), ExceptionType.SKIP)))
            .isInstanceOf(ExceptionNotAllowedException.class);
    }

    @Test
    void daily_add_rejected() {
        UUID id = createDaily();
        assertThatThrownBy(() ->
            exService.addException(userId, id, new PlannedTaskExceptionRequest(LocalDate.now(), ExceptionType.ADD)))
            .isInstanceOf(ExceptionNotAllowedException.class);
    }

    @Test
    void weekly_add_on_covered_date_rejected_noop() {
        UUID id = createWeekly(Set.of(DayOfWeek.MONDAY));
        LocalDate mon = mostRecent(DayOfWeek.MONDAY);
        assertThatThrownBy(() ->
            exService.addException(userId, id, new PlannedTaskExceptionRequest(mon, ExceptionType.ADD)))
            .isInstanceOf(ExceptionNotAllowedException.class);
    }

    @Test
    void weekly_skip_on_uncovered_date_rejected_noop() {
        UUID id = createWeekly(Set.of(DayOfWeek.MONDAY));
        LocalDate tue = mostRecent(DayOfWeek.TUESDAY);
        assertThatThrownBy(() ->
            exService.addException(userId, id, new PlannedTaskExceptionRequest(tue, ExceptionType.SKIP)))
            .isInstanceOf(ExceptionNotAllowedException.class);
    }

    @Test
    void duplicate_409() {
        UUID id = createDaily();
        LocalDate d = LocalDate.now();
        exService.addException(userId, id, new PlannedTaskExceptionRequest(d, ExceptionType.SKIP));
        assertThatThrownBy(() ->
            exService.addException(userId, id, new PlannedTaskExceptionRequest(d, ExceptionType.SKIP)))
            .isInstanceOf(ExceptionAlreadyExistsException.class);
    }

    @Test
    void remove_404_when_task_not_owned() {
        UUID id = createDaily();
        exService.addException(userId, id, new PlannedTaskExceptionRequest(LocalDate.now(), ExceptionType.SKIP));
        assertThatThrownBy(() ->
            exService.removeException(UUID.randomUUID(), id, LocalDate.now()))
            .isInstanceOf(TaskNotFoundException.class);
    }

    @Test
    void remove_clears_row() {
        UUID id = createDaily();
        LocalDate d = LocalDate.now();
        exService.addException(userId, id, new PlannedTaskExceptionRequest(d, ExceptionType.SKIP));
        exService.removeException(userId, id, d);
        assertThat(exceptions.findByTaskIdIn(List.of(id))).isEmpty();
    }

    private UUID createDaily() {
        return taskService.create(userId, new PlannedTaskRequest(
            "Daily", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            null, null, null, null)).id();
    }

    private UUID createWeekly(Set<DayOfWeek> weekdays) {
        return taskService.create(userId, new PlannedTaskRequest(
            "Weekly", null, null, Cadence.WEEKLY, true,
            "09:00", "10:00", null, weekdays, null,
            null, null, null, null)).id();
    }

    private UUID createOnce(LocalDate date) {
        return taskService.create(userId, new PlannedTaskRequest(
            "Once", null, null, Cadence.ONCE, true,
            "09:00", "10:00", date, null, null,
            null, null, null, null)).id();
    }

    private LocalDate mostRecent(DayOfWeek dow) {
        LocalDate d = LocalDate.now();
        while (d.getDayOfWeek() != dow) d = d.minusDays(1);
        return d;
    }
}
