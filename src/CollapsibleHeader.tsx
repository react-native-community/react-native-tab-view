import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  SafeAreaView,
  StyleSheet,
  View,
  FlatListProps,
  ListRenderItem,
} from 'react-native';

import TabView from './TabView';

interface Props {
  renderTabItems: (ListRenderItem<any> | null | undefined)[];
  tabBarHeight: number;
  headerHeight: number;
  onIndexChange: (index: number) => void;
  navigationState: any;
  renderHeader: React.FunctionComponent;
  renderTabBar: any;
  tabData: object[][];
  tabViewProps?: object;
  flatListProps?: Partial<FlatListProps<any>>[];
}

const CollapsibleHeader = (props: Props) => {
  const {
    renderTabItems,
    tabBarHeight,
    headerHeight,
    onIndexChange,
    navigationState,
    renderHeader,
    renderTabBar,
    tabData,
    tabViewProps = {},
    flatListProps,
  } = props;

  const { routes, index: tabIndex } = navigationState;

  const scrollY = useRef<any>(new Animated.Value(0)).current;
  const listRefArr = useRef<any[]>([]);
  const listOffset = useRef<any>({});
  const isListGliding = useRef<boolean>(false);

  useEffect(() => {
    scrollY.addListener(({ value }: any) => {
      const curRoute = routes[tabIndex].key;
      listOffset.current[curRoute] = value;
    });
    return () => {
      scrollY.removeAllListeners();
    };
  }, [routes, scrollY, tabIndex]);

  const syncScrollOffset = () => {
    const curRouteKey = routes[tabIndex].key;
    listRefArr.current.forEach((item) => {
      if (item.key === curRouteKey) {
        return;
      }

      if (scrollY._value < headerHeight && scrollY._value >= 0) {
        if (item.value) {
          item.value.scrollToOffset({
            offset: scrollY._value,
            animated: false,
          });
          listOffset.current[item.key] = scrollY._value;
        }
      } else if (
        scrollY._value >= headerHeight &&
        (listOffset.current[item.key] < headerHeight ||
          listOffset.current[item.key] == null) &&
        item.value
      ) {
        item.value.scrollToOffset({
          offset: headerHeight,
          animated: false,
        });
        listOffset.current[item.key] = headerHeight;
      }
    });
  };

  const onMomentumScrollBegin = () => {
    isListGliding.current = true;
  };

  const onMomentumScrollEnd = () => {
    isListGliding.current = false;
    syncScrollOffset();
  };

  const onScrollEndDrag = () => {
    syncScrollOffset();
  };

  const renderScene = ({ route }: any) => {
    const index = navigationState.routes.findIndex(
      ({ key }: { key: string }) => key === route.key
    );

    const renderItem = renderTabItems[index];
    const data = tabData[index];
    const flatListPropsForTab = flatListProps?.[index];

    const windowHeight = Dimensions.get('window').height;

    const contentContainerStyle = {
      paddingTop: headerHeight,
      minHeight: windowHeight - tabBarHeight,
    };

    return (
      <>
        {/* Since TabBar is absolute positioned, we need to add space so push content down below it. Don't use FlatList padding as that breaks stickyHeaders */}
        <View style={{ height: tabBarHeight }} />
        <Animated.FlatList
          scrollToOverflowEnabled
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          onMomentumScrollBegin={onMomentumScrollBegin}
          onScrollEndDrag={onScrollEndDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
          contentContainerStyle={contentContainerStyle}
          data={data}
          ref={(ref: any) => {
            if (ref) {
              const found = listRefArr.current.find((e) => e.key === route.key);
              if (!found) {
                listRefArr.current.push({
                  key: route.key,
                  value: ref,
                });
              }
            }
          }}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast" // Since we prevent switching tabs during momentum, we want it to decelerate faster
          {...flatListPropsForTab}
        />
      </>
    );
  };

  const renderTabBarWithWrapper = (innerProps: any) => {
    const y = scrollY.interpolate({
      inputRange: [0, headerHeight],
      outputRange: [headerHeight, 0],
      extrapolateRight: 'clamp',
    });

    const propsToPass = {
      onTabPress: ({ preventDefault }: any) => {
        if (isListGliding.current) {
          preventDefault();
        }
      },
      ...innerProps,
    };

    const viewStyles = {
      top: 0,
      zIndex: 1,
      position: 'absolute' as 'absolute',
      transform: [{ translateY: y }],
      width: '100%',
    };

    return (
      <Animated.View style={viewStyles}>
        {renderTabBar(propsToPass)}
      </Animated.View>
    );
  };

  const renderTabView = () => {
    return (
      <TabView
        onIndexChange={onIndexChange}
        navigationState={navigationState}
        renderScene={renderScene}
        renderTabBar={renderTabBarWithWrapper}
        initialLayout={{
          height: 0,
          width: Dimensions.get('window').width,
        }}
        {...tabViewProps}
      />
    );
  };

  const renderHeaderWithWrapper = () => {
    const y = scrollY.interpolate({
      inputRange: [0, headerHeight],
      outputRange: [0, -headerHeight],
      extrapolateRight: 'clamp',
    });

    return (
      <Animated.View
        style={[
          localStyles.header,
          { height: headerHeight },
          { transform: [{ translateY: y }] },
        ]}
      >
        {renderHeader({})}
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={localStyles.flex1}>
      <View style={localStyles.flex1}>
        {renderTabView()}
        {renderHeaderWithWrapper()}
      </View>
    </SafeAreaView>
  );
};

const localStyles = StyleSheet.create({
  header: {
    top: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    zIndex: -1,
  },
  flex1: {
    flex: 1,
  },
});

export default CollapsibleHeader;
