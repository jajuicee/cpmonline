package pb.market.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import pb.market.entity.Product;
import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {
    
    // JOIN FETCH variants AND their defaultSupplier eagerly to avoid LazyInitialization errors
    // (open-in-view=false means the session closes before Jackson serializes the response)
    @Query("SELECT DISTINCT p FROM Product p LEFT JOIN FETCH p.variants v LEFT JOIN FETCH v.defaultSupplier ORDER BY p.id DESC")
    List<Product> findAllWithVariants();

    // Used for auto-merge: find existing product by brand + model + category (case-insensitive)
    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.variants WHERE LOWER(p.brandName) = LOWER(:brand) AND LOWER(p.modelName) = LOWER(:model) AND p.category = :category")
    List<Product> findByBrandAndModelAndCategory(
        @org.springframework.data.repository.query.Param("brand") String brand,
        @org.springframework.data.repository.query.Param("model") String model,
        @org.springframework.data.repository.query.Param("category") String category
    );
    Optional<Product> findFirstByBrandNameIgnoreCaseAndModelNameIgnoreCase(String brandName, String modelName);
}
