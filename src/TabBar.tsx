import * as React from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  StyleProp,
  ViewStyle,
  TextStyle,
  LayoutChangeEvent,
  I18nManager,
  Platform,
} from 'react-native';
import Animated from 'react-native-reanimated';
import TabBarItem from './TabBarItem';
import TabBarIndicator, { Props as IndicatorProps } from './TabBarIndicator';
import memoize from './memoize';
import {
  Route,
  Scene,
  SceneRendererProps,
  NavigationState,
  Layout,
  Event,
} from './types';

export type Props<T extends Route> = SceneRendererProps & {
  navigationState: NavigationState<T>;
  scrollEnabled?: boolean;
  bounces?: boolean;
  activeColor?: string;
  inactiveColor?: string;
  pressColor?: string;
  pressOpacity?: number;
  getLabelText: (scene: Scene<T>) => string | undefined;
  getAccessible: (scene: Scene<T>) => boolean | undefined;
  getAccessibilityLabel: (scene: Scene<T>) => string | undefined;
  getTestID: (scene: Scene<T>) => string | undefined;
  renderLabel?: (
    scene: Scene<T> & {
      focused: boolean;
      color: string;
    }
  ) => React.ReactNode;
  renderIcon?: (
    scene: Scene<T> & {
      focused: boolean;
      color: string;
    }
  ) => React.ReactNode;
  renderBadge?: (scene: Scene<T>) => React.ReactNode;
  renderIndicator: (props: IndicatorProps<T>) => React.ReactNode;
  onTabPress?: (scene: Scene<T> & Event) => void;
  onTabLongPress?: (scene: Scene<T>) => void;
  tabStyle?: StyleProp<ViewStyle>;
  indicatorStyle?: StyleProp<ViewStyle>;
  indicatorContainerStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

type State = {
  tabWidths: { [key: string]: number };
};

export default class TabBar<T extends Route> extends React.Component<
  Props<T>,
  State
> {
  static defaultProps = {
    getLabelText: ({ route }: Scene<Route>) =>
      typeof route.title === 'string' ? route.title.toUpperCase() : route.title,
    getAccessible: ({ route }: Scene<Route>) =>
      typeof route.accessible !== 'undefined' ? route.accessible : true,
    getAccessibilityLabel: ({ route }: Scene<Route>) =>
      typeof route.accessibilityLabel === 'string'
        ? route.accessibilityLabel
        : typeof route.title === 'string'
        ? route.title
        : undefined,
    getTestID: ({ route }: Scene<Route>) => route.testID,
    renderIndicator: (props: IndicatorProps<Route>) => (
      <TabBarIndicator {...props} />
    ),
  };

  state: State = {
    tabWidths: {},
  };

  componentDidUpdate(prevProps: Props<T>, prevState: State) {
    const { navigationState } = this.props;
    const { tabWidths } = this.state;

    if (
      prevProps.navigationState.routes.length !==
        navigationState.routes.length ||
      prevProps.navigationState.index !== navigationState.index ||
      prevState.tabWidths !== tabWidths
    ) {
      if (
        this.getFlattenedTabWidth(this.props.tabStyle) === 'auto' &&
        !(
          this.layout.width &&
          navigationState.routes.every(
            r => typeof tabWidths[r.key] === 'number'
          )
        )
      ) {
        // When tab width is dynamic, only adjust the scroll once we have all tab widths and layout
        return;
      }

      this.resetScroll(navigationState.index);
    }
  }

  private layout: Layout = { width: 0, height: 0 };

  // to store the layout.width of each tab
  // when all onLayout's are fired, this would be set in state
  private measuredTabWidths: { [key: string]: number } = {};

  private scrollAmount = new Animated.Value(0);

  private scrollView: ScrollView | undefined;

  private getFlattenedTabWidth = (style: StyleProp<ViewStyle>) => {
    const tabStyle = StyleSheet.flatten(style);

    return tabStyle ? tabStyle.width : undefined;
  };

  private getComputedTabWidth = (
    index: number,
    layout: Layout,
    routes: Route[],
    scrollEnabled: boolean | undefined,
    tabWidths: { [key: string]: number },
    flattenedWidth: string | number | undefined
  ) => {
    if (flattenedWidth === 'auto') {
      return tabWidths[routes[index].key] || 0;
    }

    switch (typeof flattenedWidth) {
      case 'number':
        return flattenedWidth;
      case 'string':
        if (flattenedWidth.endsWith('%')) {
          const width = parseFloat(flattenedWidth);
          if (Number.isFinite(width)) {
            return layout.width * (width / 100);
          }
        }
    }

    if (scrollEnabled) {
      return (layout.width / 5) * 2;
    }

    return layout.width / routes.length;
  };

  private getMemoizedTabWidthGettter = memoize(
    (
      layout: Layout,
      routes: Route[],
      scrollEnabled: boolean | undefined,
      tabWidths: { [key: string]: number },
      flattenedWidth: string | number | undefined
    ) => (i: number) =>
      this.getComputedTabWidth(
        i,
        layout,
        routes,
        scrollEnabled,
        tabWidths,
        flattenedWidth
      )
  );

  private getMaxScrollDistance = (tabBarWidth: number, layoutWidth: number) =>
    tabBarWidth - layoutWidth;

  private getTabBarWidth = (props: Props<T>, state: State) => {
    const { tabWidths } = state;
    const { scrollEnabled, tabStyle } = props;
    const { routes } = props.navigationState;

    return routes.reduce<number>(
      (acc, _, i) =>
        acc +
        this.getComputedTabWidth(
          i,
          this.layout,
          routes,
          scrollEnabled,
          tabWidths,
          this.getFlattenedTabWidth(tabStyle)
        ),
      0
    );
  };

  private normalizeScrollValue = (
    props: Props<T>,
    state: State,
    value: number
  ) => {
    const { layout } = this;
    const tabBarWidth = this.getTabBarWidth(props, state);
    const maxDistance = this.getMaxScrollDistance(tabBarWidth, layout.width);
    const scrollValue = Math.max(Math.min(value, maxDistance), 0);

    if (Platform.OS === 'android' && I18nManager.isRTL) {
      // On Android, scroll value is not applied in reverse in RTL
      // so we need to manually adjust it to apply correct value
      return maxDistance - scrollValue;
    }

    return scrollValue;
  };

  private getScrollAmount = (props: Props<T>, state: State, index: number) => {
    const { tabWidths } = state;
    const { layout } = this;
    const { scrollEnabled, tabStyle } = props;
    const { routes } = props.navigationState;

    const centerDistance = Array.from({ length: index + 1 }).reduce<number>(
      (total, _, i) => {
        const tabWidth = this.getComputedTabWidth(
          i,
          layout,
          routes,
          scrollEnabled,
          tabWidths,
          this.getFlattenedTabWidth(tabStyle)
        );

        // To get the current index centered we adjust scroll amount by width of indexes
        // 0 through (i - 1) and add half the width of current index i
        return total + (index === i ? tabWidth / 2 : tabWidth);
      },
      0
    );

    const scrollAmount = centerDistance - layout.width / 2;

    return this.normalizeScrollValue(props, state, scrollAmount);
  };

  private resetScroll = (index: number) => {
    if (this.props.scrollEnabled) {
      this.scrollView &&
        this.scrollView.scrollTo({
          x: this.getScrollAmount(this.props, this.state, index),
          animated: true,
        });
    }
  };

  private handleLayout = (e: LayoutChangeEvent) => {
    const { height, width } = e.nativeEvent.layout;

    if (this.layout.width === width && this.layout.height === height) {
      return;
    }

    // Decided not to place layout in state because
    // onLayout is often called before applying changes
    // (according to https://facebook.github.io/react-native/docs/view.html#onlayout)
    // and new state (and related evaluation)
    // can be called before actually applying new related which might lead
    // to unexpected position of components.
    // Furthermore, component gets updated anyway after changing orientation
    // so having it stored as a class member is good enough and new values will
    // be consider in a new render.
    this.layout.height = height;
    this.layout.width = width;
  };

  private getTranslateX = memoize(
    (scrollAmount: Animated.Node<number>, maxScrollDistance: number) =>
      Animated.multiply(
        Platform.OS === 'android' && I18nManager.isRTL
          ? Animated.sub(maxScrollDistance, scrollAmount)
          : scrollAmount,
        I18nManager.isRTL ? 1 : -1
      )
  );

  render() {
    const {
      position,
      navigationState,
      jumpTo,
      scrollEnabled,
      bounces,
      getAccessibilityLabel,
      getAccessible,
      getLabelText,
      getTestID,
      renderBadge,
      renderIcon,
      renderLabel,
      activeColor,
      inactiveColor,
      pressColor,
      pressOpacity,
      onTabPress,
      onTabLongPress,
      tabStyle,
      labelStyle,
      indicatorStyle,
      contentContainerStyle,
      style,
      indicatorContainerStyle,
    } = this.props;

    const { tabWidths } = this.state;
    const { layout } = this;
    const { routes } = navigationState;

    const isWidthDynamic = this.getFlattenedTabWidth(tabStyle) === 'auto';
    const tabBarWidth = this.getTabBarWidth(this.props, this.state);
    const tabBarWidthPercent = `${routes.length * 40}%`;
    console.log(layout.width, 'rendering with');
    const translateX = this.getTranslateX(
      this.scrollAmount,
      this.getMaxScrollDistance(tabBarWidth, layout.width)
    );

    return (
      <Animated.View
        onLayout={this.handleLayout}
        style={[styles.tabBar, style]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicatorContainer,
            scrollEnabled ? { transform: [{ translateX }] as any } : null,
            tabBarWidth
              ? { width: tabBarWidth }
              : scrollEnabled
              ? { width: tabBarWidthPercent }
              : null,
            indicatorContainerStyle,
          ]}
        >
          {this.props.renderIndicator({
            position,
            layout,
            navigationState,
            jumpTo,
            width: isWidthDynamic ? 'auto' : `${100 / routes.length}%`,
            style: indicatorStyle,
            getTabWidth: this.getMemoizedTabWidthGettter(
              layout,
              routes,
              scrollEnabled,
              tabWidths,
              this.getFlattenedTabWidth(tabStyle)
            ),
          })}
        </Animated.View>
        <View style={styles.scroll}>
          <Animated.ScrollView
            horizontal
            keyboardShouldPersistTaps="handled"
            scrollEnabled={scrollEnabled}
            bounces={bounces}
            alwaysBounceHorizontal={false}
            scrollsToTop={false}
            showsHorizontalScrollIndicator={false}
            automaticallyAdjustContentInsets={false}
            overScrollMode="never"
            contentContainerStyle={[
              styles.tabContent,
              scrollEnabled
                ? { width: tabBarWidth || tabBarWidthPercent }
                : styles.container,
              contentContainerStyle,
            ]}
            scrollEventThrottle={16}
            onScroll={Animated.event([
              {
                nativeEvent: {
                  contentOffset: { x: this.scrollAmount },
                },
              },
            ])}
            ref={el => {
              // @ts-ignore
              this.scrollView = el && el.getNode();
            }}
          >
            {routes.map((route: T) => (
              <TabBarItem
                onLayout={
                  isWidthDynamic
                    ? e => {
                        this.measuredTabWidths[route.key] =
                          e.nativeEvent.layout.width;

                        // When we have measured widths for all of the tabs, we should updates the state
                        // We avoid doing separate setState for each layout since it triggers multiple renders and slows down app
                        if (
                          routes.every(
                            r =>
                              typeof this.measuredTabWidths[r.key] === 'number'
                          )
                        ) {
                          this.setState({
                            tabWidths: { ...this.measuredTabWidths },
                          });
                        }
                      }
                    : undefined
                }
                key={route.key}
                position={position}
                route={route}
                navigationState={navigationState}
                getAccessibilityLabel={getAccessibilityLabel}
                getAccessible={getAccessible}
                getLabelText={getLabelText}
                getTestID={getTestID}
                renderBadge={renderBadge}
                renderIcon={renderIcon}
                renderLabel={renderLabel}
                activeColor={activeColor}
                inactiveColor={inactiveColor}
                pressColor={pressColor}
                pressOpacity={pressOpacity}
                onPress={() => {
                  const event: Scene<T> & Event = {
                    route,
                    defaultPrevented: false,
                    preventDefault: () => {
                      event.defaultPrevented = true;
                    },
                  };

                  onTabPress && onTabPress(event);

                  if (event.defaultPrevented) {
                    return;
                  }

                  this.props.jumpTo(route.key);
                }}
                onLongPress={() => onTabLongPress && onTabLongPress({ route })}
                labelStyle={labelStyle}
                style={tabStyle}
              />
            ))}
          </Animated.ScrollView>
        </View>
      </Animated.View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    overflow: 'scroll',
  },
  tabBar: {
    backgroundColor: '#2196f3',
    elevation: 4,
    shadowColor: 'black',
    shadowOpacity: 0.1,
    shadowRadius: StyleSheet.hairlineWidth,
    shadowOffset: {
      height: StyleSheet.hairlineWidth,
      width: 0,
    },
    zIndex: 1,
  },
  tabContent: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  indicatorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
