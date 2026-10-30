package pb.market.util;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;

public class DateTimeUtil {

    private static final ZoneId DEFAULT_ZONE = ZoneId.systemDefault();

    /**
     * Safely parse a date or datetime string into a LocalDateTime.
     * Supports:
     * - ISO date: "2026-10-30" (10 chars) -> start of day (00:00:00) or end of day (23:59:59.999999)
     * - ISO datetime: "2026-10-30T13:45:00"
     * - ISO instant / offset: "2026-10-30T13:45:00.000Z" or "+08:00"
     * - Space separator: "2026-10-30 13:45:00"
     * Returns null if str is null, blank, or completely unparseable.
     */
    public static LocalDateTime parse(String str, boolean isEnd) {
        if (str == null || str.isBlank()) {
            return null;
        }
        String s = str.trim();
        // Handle URL decoded space instead of T: "2026-10-30 13:45:00"
        if (s.length() >= 19 && s.charAt(10) == ' ') {
            s = s.substring(0, 10) + "T" + s.substring(11);
        }

        // 1. Plain date: YYYY-MM-DD
        if (s.length() == 10 && s.indexOf('-') == 4) {
            try {
                LocalDate ld = LocalDate.parse(s);
                return isEnd ? ld.atTime(23, 59, 59, 999999000) : ld.atStartOfDay();
            } catch (Exception ignored) {}
        }

        // 2. ISO with Z or offset (e.g. from JS Date.toISOString())
        if (s.endsWith("Z") || s.contains("+") || (s.lastIndexOf('-') > 10)) {
            try {
                OffsetDateTime odt = OffsetDateTime.parse(s);
                return odt.atZoneSameInstant(DEFAULT_ZONE).toLocalDateTime();
            } catch (Exception ignored) {
                try {
                    Instant inst = Instant.parse(s);
                    return LocalDateTime.ofInstant(inst, DEFAULT_ZONE);
                } catch (Exception ignored2) {}
            }
        }

        // 3. Plain LocalDateTime (e.g. 2026-10-30T13:45:00)
        try {
            return LocalDateTime.parse(s);
        } catch (Exception ignored) {}

        // 4. Fallback: try prefixing 10 chars as LocalDate
        if (s.length() >= 10) {
            try {
                LocalDate ld = LocalDate.parse(s.substring(0, 10));
                return isEnd ? ld.atTime(23, 59, 59, 999999000) : ld.atStartOfDay();
            } catch (Exception ignored) {}
        }

        return null;
    }

    public static LocalDateTime parseStart(String str) {
        return parse(str, false);
    }

    public static LocalDateTime parseEnd(String str) {
        return parse(str, true);
    }
}

