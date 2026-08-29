package main

import (
	"kid-climber/internal/database"
	"kid-climber/internal/handlers"
	"log"
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// 初始化数据库
	database.InitDatabase()
	
	// 创建Gin引擎
	r := gin.Default()
	
	// 配置CORS
	config := cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}
	r.Use(cors.New(config))
	
	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	
	// API路由组
	api := r.Group("/api")
	{
		// 组件相关接口
		components := api.Group("/components")
		{
			components.GET("", handlers.GetComponents)
			components.GET("/:id", handlers.GetComponent)
			components.GET("/category/:category", handlers.GetComponentsByCategory)
			components.GET("/search", handlers.SearchComponents)
		}
		
		// 设计相关接口
		designs := api.Group("/designs")
		{
			designs.GET("", handlers.GetDesigns)
			designs.GET("/:id", handlers.GetDesign)
			designs.POST("", handlers.CreateDesign)
			designs.PUT("/:id", handlers.UpdateDesign)
			designs.DELETE("/:id", handlers.DeleteDesign)
			designs.POST("/:id/components", handlers.SaveDesignComponents)
			designs.POST("/:id/connections", handlers.SaveDesignConnections)
			designs.GET("/:id/materials", handlers.CalculateMaterialRequirement)
		}
		
		// 材料库存接口
		materials := api.Group("/materials")
		{
			materials.GET("/inventory", handlers.GetMaterialInventory)
			materials.POST("/inventory", handlers.UpdateMaterialInventory)
		}
	}
	
	// 启动服务器
	log.Println("Server starting on :8080...")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
