import { DeviceActivity } from "../../services/activityService";
import * as activityService from "../../services/activityService";
import {
  calculateHourlyActivity,
  calculateDailyActivity,
  calculateHotspots,
  getPeakActivityTime,
} from "../../utils/statisticsHelper";

interface StatisticsPanelProps {
  activities: DeviceActivity[];
}

export const StatisticsPanel = ({ activities }: StatisticsPanelProps) => {
  const hourlyData = calculateHourlyActivity(activities);
  const dailyData = calculateDailyActivity(activities);
  const hotspots = calculateHotspots(activities, 5);

  const maxHourlyCount = Math.max(...hourlyData.map((d) => d.count), 1);
  const maxDailyCount = Math.max(...dailyData.map((d) => d.count), 1);

  const peakTime = getPeakActivityTime(activities);

  // Calculate stats
  const todayActivities = activities.filter((act) =>
    activityService.isToday(act.timestamp),
  );

  return (
    <div style={{ padding: "0 16px 40px 16px" }}>
      {/* Summary Cards */}
      {/* Quick Stats */}
      <div
        style={{
          padding: "12px 16px",
          background: "#f8f9fa",
          borderRadius: "8px",
          marginBottom: "32px",
          display: "flex",
          gap: "16px",
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "12px",
              color: "#666",
              marginBottom: "12px",
            }}
          >
            今日活動
          </div>
          <div
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#4ECDC4",
            }}
          >
            {todayActivities.length}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "12px",
              color: "#666",
              marginBottom: "12px",
            }}
          >
            總活動數
          </div>
          <div
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#4ECDC4",
            }}
          >
            {activities.length}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "12px",
              color: "#666",
              marginBottom: "12px",
            }}
          >
            高峰時段
          </div>
          <div
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#4ECDC4",
            }}
          >
            {peakTime}
          </div>
        </div>
      </div>

      {/* Hotspots */}
      <div
        style={{
          padding: "20px 16px",
          marginBottom: "32px",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div
          style={{
            fontSize: "16px",
            fontWeight: "bold",
            color: "#2c3e50",
            marginBottom: "24px",
          }}
        >
          熱門地點 TOP 5
        </div>
        {hotspots.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "20px",
              color: "#999",
              fontSize: "14px",
            }}
          >
            暫無數據
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {hotspots.map((hotspot) => (
              <div
                key={hotspot.gatewayId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "14px",
                      color: "#666",
                      fontWeight: "400",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {hotspot.gatewayName}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginTop: "4px",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: "6px",
                        background: "#e0e0e0",
                        borderRadius: "3px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${hotspot.percentage}%`,
                          height: "100%",
                          background: "#4ECDC4",
                          borderRadius: "3px",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        minWidth: "50px",
                        textAlign: "right",
                      }}
                    >
                      {hotspot.count} 次
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hourly Activity Chart */}
      <div
        style={{
          padding: "20px 16px",
          marginBottom: "32px",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div
          style={{
            fontSize: "16px",
            fontWeight: "bold",
            color: "#2c3e50",
            marginBottom: "24px",
          }}
        >
          24小時活動分布
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            height: "100px",
            gap: "2px",
          }}
        >
          {hourlyData.map((data) => {
            const heightPercentage = (data.count / maxHourlyCount) * 100;
            return (
              <div
                key={data.hour}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${heightPercentage}%`,
                    background:
                      data.count > 0
                        ? "linear-gradient(180deg, #4ECDC4 0%, #44B8B2 100%)"
                        : "#e0e0e0",
                    borderRadius: "4px 4px 0 0",
                    minHeight: data.count > 0 ? "4px" : "2px",
                  }}
                />
                {data.hour % 3 === 0 && (
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#999",
                      marginTop: "4px",
                    }}
                  >
                    {data.hour}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Activity Chart */}
      <div
        style={{
          padding: "20px 16px",
          marginBottom: "32px",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div
          style={{
            fontSize: "16px",
            fontWeight: "bold",
            color: "#2c3e50",
            marginBottom: "24px",
          }}
        >
          近7天活動趨勢
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            height: "100px",
            gap: "8px",
          }}
        >
          {dailyData.map((data, index) => {
            const heightPercentage = (data.count / maxDailyCount) * 100;
            return (
              <div
                key={index}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "#4ECDC4",
                    marginBottom: "4px",
                    fontWeight: "bold",
                  }}
                >
                  {data.count > 0 ? data.count : ""}
                </div>
                <div
                  style={{
                    width: "100%",
                    height: `${heightPercentage}%`,
                    background:
                      data.count > 0
                        ? "linear-gradient(180deg, #4ECDC4 0%, #3BB5B3 100%)"
                        : "#e0e0e0",
                    borderRadius: "8px 8px 0 0",
                    minHeight: data.count > 0 ? "8px" : "4px",
                  }}
                />
                <div
                  style={{
                    fontSize: "10px",
                    color: "#999",
                    marginTop: "4px",
                  }}
                >
                  {data.date}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
