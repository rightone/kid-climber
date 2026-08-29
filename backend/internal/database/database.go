package database

import (
	"kid-climber/internal/models"
	"log"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDatabase 初始化数据库
func InitDatabase() {
	var err error
	
	// 连接SQLite数据库
	DB, err = gorm.Open(sqlite.Open("kid_climber.db"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	
	// 自动迁移数据库表
	err = DB.AutoMigrate(
		&models.Component{},
		&models.Design{},
		&models.DesignComponent{},
		&models.Connection{},
		&models.MaterialInventory{},
		&models.MaterialList{},
		&models.MaterialListItem{},
	)
	
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}
	
	log.Println("Database initialized successfully")
	
	// 初始化预设组件数据
	initPresetComponents()
}

// initPresetComponents 初始化预设组件数据
func initPresetComponents() {
	// 检查是否已有组件数据
	var count int64
	DB.Model(&models.Component{}).Count(&count)
	if count > 0 {
		return
	}
	
	// 预设组件列表
	components := []models.Component{
		// 基础管件
		{
			ID:       "pipe_30cm",
			Name:     "30cm直管",
			Type:     "pipe",
			Category: "basic",
			Length:   float64Ptr(30),
			Diameter: float64Ptr(2.5),
			ModelPath: "/models/pipe_30cm.glb",
			ThumbnailPath: "/thumbnails/pipe_30cm.png",
			ConnectionPoints: `{"points":[{"id":"start","position":[0,0,-15],"direction":[0,0,-1],"type":"socket","compatible":["socket"]},{"id":"end","position":[0,0,15],"direction":[0,0,1],"type":"socket","compatible":["socket"]}]}`,
		},
		{
			ID:       "pipe_15cm",
			Name:     "15cm直管",
			Type:     "pipe",
			Category: "basic",
			Length:   float64Ptr(15),
			Diameter: float64Ptr(2.5),
			ModelPath: "/models/pipe_15cm.glb",
			ThumbnailPath: "/thumbnails/pipe_15cm.png",
			ConnectionPoints: `{"points":[{"id":"start","position":[0,0,-7.5],"direction":[0,0,-1],"type":"socket","compatible":["socket"]},{"id":"end","position":[0,0,7.5],"direction":[0,0,1],"type":"socket","compatible":["socket"]}]}`,
		},
		
		// 连接件
		{
			ID:       "elbow_90deg",
			Name:     "90度弯头",
			Type:     "elbow",
			Category: "connector",
			Angle:    float64Ptr(90),
			Diameter: float64Ptr(2.5),
			ModelPath: "/models/elbow_90deg.glb",
			ThumbnailPath: "/thumbnails/elbow_90deg.png",
			ConnectionPoints: `{"points":[{"id":"input","position":[0,0,-5],"direction":[0,0,-1],"type":"socket","compatible":["socket"]},{"id":"output","position":[5,0,0],"direction":[1,0,0],"type":"socket","compatible":["socket"]}]}`,
		},
		{
			ID:       "elbow_45deg",
			Name:     "45度弯头",
			Type:     "elbow",
			Category: "connector",
			Angle:    float64Ptr(45),
			Diameter: float64Ptr(2.5),
			ModelPath: "/models/elbow_45deg.glb",
			ThumbnailPath: "/thumbnails/elbow_45deg.png",
			ConnectionPoints: `{"points":[{"id":"input","position":[0,0,-5],"direction":[0,0,-1],"type":"socket","compatible":["socket"]},{"id":"output","position":[3.54,0,3.54],"direction":[0.707,0,0.707],"type":"socket","compatible":["socket"]}]}`,
		},
		{
			ID:       "tee_3way",
			Name:     "三通接头",
			Type:     "tee",
			Category: "connector",
			Diameter: float64Ptr(2.5),
			ModelPath: "/models/tee_3way.glb",
			ThumbnailPath: "/thumbnails/tee_3way.png",
			ConnectionPoints: `{"points":[{"id":"input","position":[0,0,-5],"direction":[0,0,-1],"type":"socket","compatible":["socket"]},{"id":"output1","position":[5,0,0],"direction":[1,0,0],"type":"socket","compatible":["socket"]},{"id":"output2","position":[-5,0,0],"direction":[-1,0,0],"type":"socket","compatible":["socket"]}]}`,
		},
		{
			ID:       "cross_4way",
			Name:     "四通接头",
			Type:     "cross",
			Category: "connector",
			Diameter: float64Ptr(2.5),
			ModelPath: "/models/cross_4way.glb",
			ThumbnailPath: "/thumbnails/cross_4way.png",
			ConnectionPoints: `{"points":[{"id":"input","position":[0,0,-5],"direction":[0,0,-1],"type":"socket","compatible":["socket"]},{"id":"output1","position":[5,0,0],"direction":[1,0,0],"type":"socket","compatible":["socket"]},{"id":"output2","position":[-5,0,0],"direction":[-1,0,0],"type":"socket","compatible":["socket"]},{"id":"output3","position":[0,0,5],"direction":[0,0,1],"type":"socket","compatible":["socket"]}]}`,
		},
		
		// 平台类
		{
			ID:       "platform_small",
			Name:     "小平台",
			Type:     "platform",
			Category: "platform",
			Width:    float64Ptr(30),
			Height:   float64Ptr(30),
			ModelPath: "/models/platform_small.glb",
			ThumbnailPath: "/thumbnails/platform_small.png",
			ConnectionPoints: `{"points":[{"id":"corner1","position":[-15,0,-15],"direction":[0,-1,0],"type":"socket","compatible":["socket"]},{"id":"corner2","position":[15,0,-15],"direction":[0,-1,0],"type":"socket","compatible":["socket"]},{"id":"corner3","position":[15,0,15],"direction":[0,-1,0],"type":"socket","compatible":["socket"]},{"id":"corner4","position":[-15,0,15],"direction":[0,-1,0],"type":"socket","compatible":["socket"]}]}`,
		},
		{
			ID:       "platform_medium",
			Name:     "中平台",
			Type:     "platform",
			Category: "platform",
			Width:    float64Ptr(60),
			Height:   float64Ptr(60),
			ModelPath: "/models/platform_medium.glb",
			ThumbnailPath: "/thumbnails/platform_medium.png",
			ConnectionPoints: `{"points":[{"id":"corner1","position":[-30,0,-30],"direction":[0,-1,0],"type":"socket","compatible":["socket"]},{"id":"corner2","position":[30,0,-30],"direction":[0,-1,0],"type":"socket","compatible":["socket"]},{"id":"corner3","position":[30,0,30],"direction":[0,-1,0],"type":"socket","compatible":["socket"]},{"id":"corner4","position":[-30,0,30],"direction":[0,-1,0],"type":"socket","compatible":["socket"]}]}`,
		},
		{
			ID:       "platform_large",
			Name:     "大平台",
			Type:     "platform",
			Category: "platform",
			Width:    float64Ptr(90),
			Height:   float64Ptr(90),
			ModelPath: "/models/platform_large.glb",
			ThumbnailPath: "/thumbnails/platform_large.png",
			ConnectionPoints: `{"points":[{"id":"corner1","position":[-45,0,-45],"direction":[0,-1,0],"type":"socket","compatible":["socket"]},{"id":"corner2","position":[45,0,-45],"direction":[0,-1,0],"type":"socket","compatible":["socket"]},{"id":"corner3","position":[45,0,45],"direction":[0,-1,0],"type":"socket","compatible":["socket"]},{"id":"corner4","position":[-45,0,45],"direction":[0,-1,0],"type":"socket","compatible":["socket"]}]}`,
		},
		
		// 附件
		{
			ID:       "swing",
			Name:     "秋千",
			Type:     "swing",
			Category: "accessory",
			Width:    float64Ptr(30),
			Height:   float64Ptr(200),
			ModelPath: "/models/swing.glb",
			ThumbnailPath: "/thumbnails/swing.png",
			ConnectionPoints: `{"points":[{"id":"top_left","position":[-15,100,0],"direction":[0,1,0],"type":"socket","compatible":["socket"]},{"id":"top_right","position":[15,100,0],"direction":[0,1,0],"type":"socket","compatible":["socket"]}]}`,
		},
		{
			ID:       "slide",
			Name:     "滑梯",
			Type:     "slide",
			Category: "accessory",
			Width:    float64Ptr(40),
			Height:   float64Ptr(150),
			ModelPath: "/models/slide.glb",
			ThumbnailPath: "/thumbnails/slide.png",
			ConnectionPoints: `{"points":[{"id":"top","position":[0,75,-20],"direction":[0,1,0],"type":"socket","compatible":["socket"]},{"id":"bottom","position":[0,0,20],"direction":[0,-1,0],"type":"socket","compatible":["socket"]}]}`,
		},
		{
			ID:       "rope_ladder",
			Name:     "绳梯",
			Type:     "rope_ladder",
			Category: "accessory",
			Width:    float64Ptr(30),
			Height:   float64Ptr(180),
			ModelPath: "/models/rope_ladder.glb",
			ThumbnailPath: "/thumbnails/rope_ladder.png",
			ConnectionPoints: `{"points":[{"id":"top","position":[0,90,0],"direction":[0,1,0],"type":"socket","compatible":["socket"]},{"id":"bottom","position":[0,-90,0],"direction":[0,-1,0],"type":"socket","compatible":["socket"]}]}`,
		},
	}
	
	// 批量插入组件数据
	result := DB.Create(&components)
	if result.Error != nil {
		log.Printf("Failed to insert preset components: %v", result.Error)
	} else {
		log.Printf("Inserted %d preset components", len(components))
	}
}

// float64Ptr 返回float64指针
func float64Ptr(f float64) *float64 {
	return &f
}

// GetDB 获取数据库实例
func GetDB() *gorm.DB {
	return DB
}
