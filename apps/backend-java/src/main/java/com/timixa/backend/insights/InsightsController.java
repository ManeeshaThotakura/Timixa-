package com.timixa.backend.insights;

import com.timixa.backend.insights.dto.BedtimeSummaryResponse;
import com.timixa.backend.insights.dto.InsightSummaryResponse;
import com.timixa.backend.security.UserPrincipal;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/insights")
public class InsightsController {

    private final InsightsService service;

    public InsightsController(InsightsService service) {
        this.service = service;
    }

    @GetMapping("/bedtime")
    public BedtimeSummaryResponse bedtime(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(value = "date", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.bedtime(principal.id(), date == null ? LocalDate.now() : date);
    }

    @GetMapping("/summary")
    public InsightSummaryResponse summary(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(value = "days", required = false, defaultValue = "7") int days) {
        return service.summary(principal.id(), days);
    }
}
