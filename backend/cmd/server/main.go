package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"kid-climber/internal/database"
	"kid-climber/internal/handlers"
	"log"
	"net"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

type readyEvent struct {
	Event  string `json:"event"`
	APIURL string `json:"api_url"`
}

func newRouter() *gin.Engine {
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

	return r
}

func run(listenAddress string, databasePath string, stdout *os.File) error {
	if err := database.InitDatabase(databasePath); err != nil {
		return err
	}

	listener, err := net.Listen("tcp", listenAddress)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", listenAddress, err)
	}
	defer listener.Close()

	address := listener.Addr().(*net.TCPAddr)
	event := readyEvent{
		Event:  "ready",
		APIURL: fmt.Sprintf("http://127.0.0.1:%d/api", address.Port),
	}
	if err := json.NewEncoder(stdout).Encode(event); err != nil {
		return fmt.Errorf("write readiness event: %w", err)
	}

	if err := newRouter().RunListener(listener); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("serve HTTP: %w", err)
	}
	return nil
}

func main() {
	listenAddress := flag.String("listen", "127.0.0.1:8080", "local TCP address to listen on")
	databasePath := flag.String("database", "kid_climber.db", "SQLite database path")
	flag.Parse()

	if err := run(*listenAddress, *databasePath, os.Stdout); err != nil {
		log.Fatal(err)
	}
}
