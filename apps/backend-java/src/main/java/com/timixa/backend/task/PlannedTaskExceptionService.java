package com.timixa.backend.task;

import com.timixa.backend.common.ExceptionAlreadyExistsException;
import com.timixa.backend.common.ExceptionNotAllowedException;
import com.timixa.backend.common.TaskNotFoundException;
import com.timixa.backend.task.dto.PlannedTaskExceptionRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Service
public class PlannedTaskExceptionService {

    private final PlannedTaskRepository tasks;
    private final PlannedTaskExceptionRepository exceptions;
    private final PlannedTaskService taskService;

    public PlannedTaskExceptionService(PlannedTaskRepository tasks,
                                       PlannedTaskExceptionRepository exceptions,
                                       PlannedTaskService taskService) {
        this.tasks = tasks;
        this.exceptions = exceptions;
        this.taskService = taskService;
    }

    @Transactional
    public void addException(UUID userId, UUID taskId, PlannedTaskExceptionRequest req) {
        PlannedTask t = taskService.requireOwnedTask(userId, taskId);
        validate(t, req);
        if (exceptions.existsById(new PlannedTaskExceptionId(taskId, req.date())))
            throw new ExceptionAlreadyExistsException();
        exceptions.save(new PlannedTaskException(taskId, req.date(), req.type(), Instant.now()));
    }

    @Transactional
    public void removeException(UUID userId, UUID taskId, LocalDate date) {
        taskService.requireOwnedTask(userId, taskId);
        exceptions.deleteByTaskIdAndExceptionDate(taskId, date);
    }

    private void validate(PlannedTask t, PlannedTaskExceptionRequest req) {
        Cadence c = t.getCadence();
        if (c == Cadence.ONCE)
            throw new ExceptionNotAllowedException("Exceptions are not allowed on ONCE tasks");
        if (c == Cadence.DAILY && req.type() == ExceptionType.ADD)
            throw new ExceptionNotAllowedException("ADD exception is not allowed on DAILY tasks");

        boolean covered = switch (c) {
            case DAILY -> true;
            case WEEKLY -> t.getWeekdaysSet().contains(req.date().getDayOfWeek());
            case MONTHLY -> t.getMonthDaysSet().contains(req.date().getDayOfMonth());
            case ONCE -> false;
        };

        if (req.type() == ExceptionType.ADD && covered)
            throw new ExceptionNotAllowedException("ADD on a date already covered by cadence is a no-op");
        if (req.type() == ExceptionType.SKIP && !covered)
            throw new ExceptionNotAllowedException("SKIP on a date not covered by cadence is a no-op");
    }
}
