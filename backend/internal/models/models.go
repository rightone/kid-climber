package models

import (
	"time"
)

// Component 组件定义
type Component struct {
	ID              string    `json:"id" gorm:"primaryKey"`
	Name            string    `json:"name" gorm:"not null"`
	Type            string    `json:"type" gorm:"not null"`
	Category        string    `json:"category" gorm:"not null"`
	Length          *float64  `json:"length,omitempty"`
	Diameter        *float64  `json:"diameter,omitempty"`
	Angle           *float64  `json:"angle,omitempty"`
	Width           *float64  `json:"width,omitempty"`
	Height          *float64  `json:"height,omitempty"`
	ModelPath       string    `json:"modelPath"`
	ThumbnailPath   string    `json:"thumbnailPath"`
	ConnectionPoints string   `json:"connectionPoints" gorm:"type:text"` // JSON格式
	Properties      string    `json:"properties" gorm:"type:text"`       // JSON格式
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// Design 设计文件
type Design struct {
	ID              int64     `json:"id" gorm:"primaryKey"`
	Name            string    `json:"name" gorm:"not null"`
	Description     string    `json:"description"`
	Version         string    `json:"version" gorm:"default:1.0"`
	Status          string    `json:"status" gorm:"default:draft"`
	ThumbnailPath   string    `json:"thumbnailPath"`
	TotalComponents int       `json:"totalComponents" gorm:"default:0"`
	EstimatedCost   float64   `json:"estimatedCost" gorm:"default:0"`
	Metadata        string    `json:"metadata" gorm:"type:text"` // JSON格式
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
	PublishedAt     *time.Time `json:"publishedAt,omitempty"`
}

// DesignComponent 设计中的组件实例
type DesignComponent struct {
	ID            int64   `json:"id" gorm:"primaryKey"`
	DesignID      int64   `json:"designId" gorm:"not null"`
	ComponentID   string  `json:"componentId" gorm:"not null"`
	InstanceName  string  `json:"instanceName"`
	PositionX     float64 `json:"positionX" gorm:"not null"`
	PositionY     float64 `json:"positionY" gorm:"not null"`
	PositionZ     float64 `json:"positionZ" gorm:"not null"`
	RotationX     float64 `json:"rotationX" gorm:"default:0"`
	RotationY     float64 `json:"rotationY" gorm:"default:0"`
	RotationZ     float64 `json:"rotationZ" gorm:"default:0"`
	ScaleX        float64 `json:"scaleX" gorm:"default:1"`
	ScaleY        float64 `json:"scaleY" gorm:"default:1"`
	ScaleZ        float64 `json:"scaleZ" gorm:"default:1"`
	Properties    string  `json:"properties" gorm:"type:text"` // JSON格式
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// Connection 组件连接关系
type Connection struct {
	ID                int64     `json:"id" gorm:"primaryKey"`
	DesignID          int64     `json:"designId" gorm:"not null"`
	SourceComponentID int64     `json:"sourceComponentId" gorm:"not null"`
	SourcePointID     string    `json:"sourcePointId" gorm:"not null"`
	TargetComponentID int64     `json:"targetComponentId" gorm:"not null"`
	TargetPointID     string    `json:"targetPointId" gorm:"not null"`
	ConnectionType    string    `json:"connectionType" gorm:"not null"`
	IsActive          bool      `json:"isActive" gorm:"default:true"`
	CreatedAt         time.Time `json:"createdAt"`
}

// MaterialInventory 用户材料库存
type MaterialInventory struct {
	ID            int64     `json:"id" gorm:"primaryKey"`
	UserID        int64     `json:"userId" gorm:"default:1"`
	ComponentID   string    `json:"componentId" gorm:"not null"`
	Quantity      int       `json:"quantity" gorm:"not null;default:0"`
	PurchasePrice *float64  `json:"purchasePrice,omitempty"`
	PurchaseDate  *time.Time `json:"purchaseDate,omitempty"`
	Notes         string    `json:"notes"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// MaterialList 材料清单
type MaterialList struct {
	ID          int64     `json:"id" gorm:"primaryKey"`
	DesignID    int64     `json:"designId" gorm:"not null"`
	ListType    string    `json:"listType" gorm:"not null"`
	TotalItems  int       `json:"totalItems" gorm:"default:0"`
	TotalCost   float64   `json:"totalCost" gorm:"default:0"`
	Notes       string    `json:"notes"`
	GeneratedAt time.Time `json:"generatedAt"`
}

// MaterialListItem 材料清单项
type MaterialListItem struct {
	ID           int64   `json:"id" gorm:"primaryKey"`
	ListID       int64   `json:"listId" gorm:"not null"`
	ComponentID  string  `json:"componentId" gorm:"not null"`
	Quantity     int     `json:"quantity" gorm:"not null"`
	UnitPrice    *float64 `json:"unitPrice,omitempty"`
	TotalPrice   *float64 `json:"totalPrice,omitempty"`
	Notes        string  `json:"notes"`
}

// DesignFile 设计文件格式（用于导入导出）
type DesignFile struct {
	Version    string                 `json:"version"`
	Metadata   DesignMetadata         `json:"metadata"`
	Components []ComponentInstance     `json:"components"`
	Connections []ConnectionData       `json:"connections"`
	Materials  map[string]MaterialReq `json:"materials"`
	Settings   DesignSettings         `json:"settings"`
}

// DesignMetadata 设计元数据
type DesignMetadata struct {
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Created     time.Time `json:"created"`
	Modified    time.Time `json:"modified"`
	Author      string    `json:"author"`
	Tags        []string  `json:"tags"`
}

// ComponentInstance 组件实例
type ComponentInstance struct {
	InstanceID  string    `json:"instanceId"`
	ComponentID string    `json:"componentId"`
	Name        string    `json:"name,omitempty"`
	Transform   Transform `json:"transform"`
	Properties  map[string]interface{} `json:"properties,omitempty"`
}

// Transform 变换信息
type Transform struct {
	Position [3]float64 `json:"position"`
	Rotation [3]float64 `json:"rotation"`
	Scale    [3]float64 `json:"scale"`
}

// ConnectionData 连接数据
type ConnectionData struct {
	ID     string         `json:"id"`
	Source ConnectionEnd  `json:"source"`
	Target ConnectionEnd  `json:"target"`
	Type   string         `json:"type"`
}

// ConnectionEnd 连接端点
type ConnectionEnd struct {
	ComponentID string `json:"componentId"`
	PointID     string `json:"pointId"`
}

// MaterialReq 材料需求
type MaterialReq struct {
	Required  int `json:"required"`
	Available int `json:"available"`
	Shortage  int `json:"shortage"`
}

// DesignSettings 设计设置
type DesignSettings struct {
	GridSize       int    `json:"gridSize"`
	SnapToGrid     bool   `json:"snapToGrid"`
	ShowConnections bool  `json:"showConnections"`
	ViewMode       string `json:"viewMode"`
}
