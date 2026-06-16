package com.timixa.backend.proxy;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.io.IOException;

@RestController
public class LegacyProxyController {

    private final WebClient legacy;

    public LegacyProxyController(WebClient legacyClient) { this.legacy = legacyClient; }

    @RequestMapping("/api/**")
    public Mono<ResponseEntity<byte[]>> proxy(HttpServletRequest request) throws IOException {
        String path = request.getRequestURI();
        String query = request.getQueryString();
        String upstreamPath = path.replaceFirst("^/api", "");
        String fullPath = upstreamPath + (query != null ? "?" + query : "");

        byte[] body = request.getInputStream().readAllBytes();
        HttpMethod method = HttpMethod.valueOf(request.getMethod());

        WebClient.RequestBodySpec spec = legacy.method(method).uri(fullPath);

        var headerNames = request.getHeaderNames();
        while (headerNames.hasMoreElements()) {
            String h = headerNames.nextElement();
            if (h.equalsIgnoreCase("host") || h.equalsIgnoreCase("content-length")) continue;
            spec.header(h, request.getHeader(h));
        }

        WebClient.RequestHeadersSpec<?> finalSpec =
            body.length == 0 ? spec : spec.body(BodyInserters.fromValue(body));

        return finalSpec.exchangeToMono(resp ->
            resp.bodyToMono(byte[].class)
                .defaultIfEmpty(new byte[0])
                .map(bytes -> {
                    ResponseEntity.BodyBuilder out = ResponseEntity.status(resp.statusCode());
                    resp.headers().asHttpHeaders().forEach((k, v) -> {
                        if (!k.equalsIgnoreCase("transfer-encoding")) out.header(k, v.toArray(new String[0]));
                    });
                    return out.body(bytes);
                })
        );
    }
}
