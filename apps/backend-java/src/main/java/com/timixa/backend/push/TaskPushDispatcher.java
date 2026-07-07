package com.timixa.backend.push;

import com.timixa.backend.task.ExceptionType;
import com.timixa.backend.task.PlannedTask;
import com.timixa.backend.task.PlannedTaskCompletionRepository;
import com.timixa.backend.task.PlannedTaskExceptionRepository;
import com.timixa.backend.task.PlannedTaskRepository;
import com.timixa.backend.task.PlannedTaskService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class TaskPushDispatcher {

    private final PlannedTaskRepository tasks;
    private final PlannedTaskExceptionRepository exceptions;
    private final PlannedTaskCompletionRepository completions;
    private final PushSender sender;

    // Fired keys (taskId:type:date) — prevents double sends if two ticks land in one minute.
    private final Set<String> fired = ConcurrentHashMap.newKeySet();
    private volatile LocalDate firedDay = LocalDate.now();

    public TaskPushDispatcher(PlannedTaskRepository tasks,
                              PlannedTaskExceptionRepository exceptions,
                              PlannedTaskCompletionRepository completions,
                              PushSender sender) {
        this.tasks = tasks;
        this.exceptions = exceptions;
        this.completions = completions;
        this.sender = sender;
    }

    @Scheduled(fixedRate = 60_000, initialDelay = 15_000)
    public void tick() {
        LocalDate today = LocalDate.now();
        if (!today.equals(firedDay)) {
            fired.clear();
            firedDay = today;
        }
        LocalTime now = LocalTime.now();
        String hhmm = String.format("%02d:%02d", now.getHour(), now.getMinute());

        for (PlannedTask t : tasks.findByNotifyAtStartTrueAndStartTime(hhmm)) {
            maybeSend(t, today, "start",
                "Time to start: " + t.getTitle(),
                "Scheduled " + t.getStartTime() + "–" + (t.getEndTime() == null ? "" : t.getEndTime()));
        }
        for (PlannedTask t : tasks.findByNotifyAtEndTrueAndEndTime(hhmm)) {
            maybeSend(t, today, "end",
                "Time's up: " + t.getTitle(),
                "Wrap it up and mark it done.");
        }
    }

    private void maybeSend(PlannedTask t, LocalDate today, String type, String title, String body) {
        String key = t.getId() + ":" + type + ":" + today;
        if (fired.contains(key)) return;
        if (!appliesToday(t, today)) return;
        if (isCompletedToday(t, today)) return;
        fired.add(key);
        sender.sendToUser(t.getUserId(), payload(title, body));
    }

    private boolean appliesToday(PlannedTask t, LocalDate today) {
        Map<LocalDate, ExceptionType> exMap = new HashMap<>();
        exceptions.findByTaskIdIn(List.of(t.getId())).forEach(e ->
            exMap.put(e.getExceptionDate(), e.getExceptionType()));
        return PlannedTaskService.appliesOn(t, today, exMap);
    }

    private boolean isCompletedToday(PlannedTask t, LocalDate today) {
        return completions.findByTaskIdAndCompletedDate(t.getId(), today)
            .map(c -> c.getCount() >= PlannedTaskService.targetFor(t))
            .orElse(false);
    }

    /** Payload shape the Angular service worker renders automatically. */
    private static String payload(String title, String body) {
        return "{\"notification\":{\"title\":\"" + escape(title) + "\","
            + "\"body\":\"" + escape(body) + "\","
            + "\"icon\":\"/favicon.ico\","
            + "\"data\":{\"onActionClick\":{\"default\":{\"operation\":\"navigateLastFocusedOrOpen\",\"url\":\"/dashboard\"}}}}}";
    }

    private static String escape(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
