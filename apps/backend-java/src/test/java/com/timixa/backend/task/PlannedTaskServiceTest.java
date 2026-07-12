package com.timixa.backend.task;

import com.timixa.backend.common.TaskAlreadyCompleteException;
import com.timixa.backend.common.TaskNotFoundException;
import com.timixa.backend.task.dto.PlannedTaskRequest;
import com.timixa.backend.task.dto.PlannedTaskResponse;
import com.timixa.backend.task.dto.PlannedTaskUpdateRequest;
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
class PlannedTaskServiceTest {

    @Autowired PlannedTaskService service;
    @Autowired PlannedTaskExceptionService exceptionService;
    @Autowired PlannedTaskRepository tasks;
    @Autowired PlannedTaskCompletionRepository completions;
    @Autowired PlannedTaskExceptionRepository exceptions;

    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void clean() {
        exceptions.deleteAll();
        completions.deleteAll();
        tasks.deleteAll();
    }

    @Test
    void create_daily_with_times() {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Gym", "Fitness", "#451de3", Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            null, null, null, null
        );
        PlannedTaskResponse r = service.create(userId, req);
        assertThat(r.id()).isNotNull();
        assertThat(r.cadence()).isEqualTo(Cadence.DAILY);
        assertThat(r.startTime()).isEqualTo("09:00");
        assertThat(r.completedToday()).isFalse();
    }

    @Test
    void create_rejects_daily_with_scheduled_date() {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "X", null, null, Cadence.DAILY, true,
            null, null, LocalDate.now(), null, null,
            null, null, null, null);
        assertThatThrownBy(() -> service.create(userId, req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("DAILY");
    }

    @Test
    void create_allows_floating_weekly_without_weekdays() {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "X", null, null, Cadence.WEEKLY, true,
            null, null, null, null, null,
            null, null, null, null);
        var created = service.create(userId, req);
        assertThat(created.cadence()).isEqualTo(Cadence.WEEKLY);
        assertThat(created.weekdays()).isNull();
    }

    @Test
    void create_rejects_no_time_slot_with_times() {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "X", null, null, Cadence.DAILY, false,
            "09:00", "10:00", null, null, null,
            null, null, null, null);
        assertThatThrownBy(() -> service.create(userId, req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("needsTimeSlot=false");
    }

    @Test
    void create_rejects_endTime_before_startTime() {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "X", null, null, Cadence.DAILY, true,
            "10:00", "09:00", null, null, null,
            null, null, null, null);
        assertThatThrownBy(() -> service.create(userId, req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("endTime");
    }

    @Test
    void findForDate_daily_always_matches() {
        service.create(userId, new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true, "09:00", "10:00", null, null, null,
            null, null, null, null));
        List<PlannedTaskResponse> out = service.findForDate(userId, LocalDate.now());
        assertThat(out).hasSize(1);
    }

    @Test
    void findForDate_weekly_filters_by_weekday() {
        DayOfWeek today = LocalDate.now().getDayOfWeek();
        DayOfWeek tomorrow = today.plus(1);

        service.create(userId, new PlannedTaskRequest(
            "Match", null, null, Cadence.WEEKLY, true,
            "09:00", "10:00", null, Set.of(today), null,
            null, null, null, null));
        service.create(userId, new PlannedTaskRequest(
            "NoMatch", null, null, Cadence.WEEKLY, true,
            "09:00", "10:00", null, Set.of(tomorrow), null,
            null, null, null, null));

        List<PlannedTaskResponse> out = service.findForDate(userId, LocalDate.now());
        assertThat(out).extracting(PlannedTaskResponse::title).containsExactly("Match");
    }

    @Test
    void findForDate_monthly_filters_by_day_of_month() {
        int today = LocalDate.now().getDayOfMonth();
        int other = today == 1 ? 2 : 1;

        service.create(userId, new PlannedTaskRequest(
            "Match", null, null, Cadence.MONTHLY, true,
            "09:00", "10:00", null, null, Set.of(today),
            null, null, null, null));
        service.create(userId, new PlannedTaskRequest(
            "NoMatch", null, null, Cadence.MONTHLY, true,
            "09:00", "10:00", null, null, Set.of(other),
            null, null, null, null));

        List<PlannedTaskResponse> out = service.findForDate(userId, LocalDate.now());
        assertThat(out).extracting(PlannedTaskResponse::title).containsExactly("Match");
    }

    @Test
    void findForDate_once_matches_only_on_scheduled_date() {
        LocalDate today = LocalDate.now();
        service.create(userId, new PlannedTaskRequest(
            "Today", null, null, Cadence.ONCE, true, null, null, today, null, null,
            null, null, null, null));
        service.create(userId, new PlannedTaskRequest(
            "Tomorrow", null, null, Cadence.ONCE, true, null, null, today.plusDays(1), null, null,
            null, null, null, null));
        List<PlannedTaskResponse> out = service.findForDate(userId, today);
        assertThat(out).extracting(PlannedTaskResponse::title).containsExactly("Today");
    }

    @Test
    void findForDate_isolates_users() {
        UUID otherUser = UUID.randomUUID();
        service.create(userId, new PlannedTaskRequest(
            "Mine", null, null, Cadence.DAILY, true, "09:00", "10:00", null, null, null,
            null, null, null, null));
        service.create(otherUser, new PlannedTaskRequest(
            "Theirs", null, null, Cadence.DAILY, true, "09:00", "10:00", null, null, null,
            null, null, null, null));
        List<PlannedTaskResponse> out = service.findForDate(userId, LocalDate.now());
        assertThat(out).extracting(PlannedTaskResponse::title).containsExactly("Mine");
    }

    @Test
    void complete_then_uncomplete_round_trip() {
        UUID id = service.create(userId, new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true, "09:00", "10:00", null, null, null,
            null, null, null, null)).id();

        PlannedTaskResponse afterComplete = service.complete(userId, id, LocalDate.now());
        assertThat(afterComplete.completedToday()).isTrue();

        assertThatThrownBy(() -> service.complete(userId, id, LocalDate.now()))
            .isInstanceOf(TaskAlreadyCompleteException.class);

        service.uncomplete(userId, id, LocalDate.now());
        List<PlannedTaskResponse> out = service.findForDate(userId, LocalDate.now());
        assertThat(out).singleElement()
            .satisfies(r -> assertThat(r.completedToday()).isFalse());
    }

    @Test
    void complete_404_when_not_owned() {
        UUID id = service.create(UUID.randomUUID(), new PlannedTaskRequest(
            "Theirs", null, null, Cadence.DAILY, true, "09:00", "10:00", null, null, null,
            null, null, null, null)).id();

        assertThatThrownBy(() -> service.complete(userId, id, LocalDate.now()))
            .isInstanceOf(TaskNotFoundException.class);
    }

    @Test
    void update_patches_only_provided_fields() {
        UUID id = service.create(userId, new PlannedTaskRequest(
            "Gym", "Fitness", null, Cadence.DAILY, true, "09:00", "10:00", null, null, null,
            null, null, null, null)).id();

        PlannedTaskUpdateRequest patch = new PlannedTaskUpdateRequest(
            null, null, null, null, null, "08:00", "09:00", null, null, null,
            null, null, null, null, null, null);
        PlannedTaskResponse r = service.update(userId, id, patch);
        assertThat(r.title()).isEqualTo("Gym");
        assertThat(r.goal()).isEqualTo("Fitness");
        assertThat(r.startTime()).isEqualTo("08:00");
        assertThat(r.endTime()).isEqualTo("09:00");
    }

    @Test
    void delete_cascades_completions() {
        UUID id = service.create(userId, new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true, "09:00", "10:00", null, null, null,
            null, null, null, null)).id();
        service.complete(userId, id, LocalDate.now());
        service.delete(userId, id);
        assertThat(tasks.findById(id)).isEmpty();
        assertThat(completions.findCompletedTaskIds(List.of(id), LocalDate.now())).isEmpty();
    }

    @Test
    void create_accepts_constraints() {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            30, 60, 5, 10);
        var r = service.create(userId, req);
        assertThat(r.minTimeMinutes()).isEqualTo(30);
        assertThat(r.maxTimeMinutes()).isEqualTo(60);
        assertThat(r.minCount()).isEqualTo(5);
        assertThat(r.maxCount()).isEqualTo(10);
    }

    @Test
    void create_accepts_partial_constraints() {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            null, 60, 5, null);
        var r = service.create(userId, req);
        assertThat(r.minTimeMinutes()).isNull();
        assertThat(r.maxTimeMinutes()).isEqualTo(60);
        assertThat(r.minCount()).isEqualTo(5);
        assertThat(r.maxCount()).isNull();
    }

    @Test
    void create_rejects_max_less_than_min_time() {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            60, 30, null, null);
        assertThatThrownBy(() -> service.create(userId, req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("maxTimeMinutes");
    }

    @Test
    void create_rejects_max_less_than_min_count() {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            null, null, 10, 5);
        assertThatThrownBy(() -> service.create(userId, req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("maxCount");
    }

    @Test
    void findForDate_daily_respects_skip_exception() {
        var id = service.create(userId, new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            null, null, null, null)).id();
        exceptionService.addException(userId, id,
            new com.timixa.backend.task.dto.PlannedTaskExceptionRequest(
                java.time.LocalDate.now(), ExceptionType.SKIP));
        var out = service.findForDate(userId, java.time.LocalDate.now());
        assertThat(out).isEmpty();
    }

    @Test
    void findForDate_weekly_respects_add_exception_on_uncovered_day() {
        java.time.DayOfWeek today = java.time.LocalDate.now().getDayOfWeek();
        java.time.DayOfWeek tomorrow = today.plus(1);
        var id = service.create(userId, new PlannedTaskRequest(
            "Gym", null, null, Cadence.WEEKLY, true,
            "09:00", "10:00", null, java.util.Set.of(tomorrow), null,
            null, null, null, null)).id();
        assertThat(service.findForDate(userId, java.time.LocalDate.now())).isEmpty();
        exceptionService.addException(userId, id,
            new com.timixa.backend.task.dto.PlannedTaskExceptionRequest(
                java.time.LocalDate.now(), ExceptionType.ADD));
        assertThat(service.findForDate(userId, java.time.LocalDate.now())).hasSize(1);
    }
}
