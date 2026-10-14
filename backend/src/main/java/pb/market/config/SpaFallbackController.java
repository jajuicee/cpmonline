package pb.market.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * SPA (Single Page Application) fallback controller.
 *
 * When the frontend is served from Spring Boot's static resources,
 * React Router handles client-side routing. If a user navigates directly
 * to e.g. /orders or /inventory, Spring Boot would normally return 404
 * because there's no server-side route for those paths.
 *
 * This controller catches non-API errors and forwards them to index.html with 200 OK,
 * letting React Router take over cleanly without browser failure codes.
 */
@Controller
public class SpaFallbackController implements ErrorController {

    @RequestMapping("/error")
    public String handleError(HttpServletRequest request, HttpServletResponse response) {
        Object status = request.getAttribute("jakarta.servlet.error.status_code");
        String uri = (String) request.getAttribute("jakarta.servlet.error.request_uri");
        // If it's an API route or static asset, don't forward to index.html
        if (uri != null && (uri.startsWith("/api/") || uri.startsWith("/ws/"))) {
            return null;
        }
        response.setStatus(HttpStatus.OK.value());
        return "forward:/index.html";
    }
}
