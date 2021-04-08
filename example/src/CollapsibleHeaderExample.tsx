import * as React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import {
  TabBar,
  NavigationState,
  SceneRendererProps,
} from 'react-native-tab-view';
import Article from './Shared/Article';
import Albums from './Shared/Albums';
import Contacts from './Shared/Contacts';

import CollapsibleHeader from '../../src/CollapsibleHeader';

type State = NavigationState<{
  key: string;
  title: string;
}>;

// These must be hardcoded to support the various animations needed for the effect
const HEADER_HEIGHT = 144;
const TAB_BAR_HEIGHT = 48;

export default class CollapsibleHeaderExample extends React.Component<
  {},
  State
> {
  // eslint-disable-next-line react/sort-comp
  static title = 'Collapsible header tab bar';
  static backgroundColor = '#3f51b5';
  static appbarElevation = 0;

  state = {
    index: 1,
    routes: [
      { key: 'article', title: 'Article' },
      { key: 'contacts', title: 'Contacts' },
      { key: 'albums', title: 'Albums' },
    ],
  };

  private handleIndexChange = (index: number) =>
    this.setState({
      index,
    });

  private renderTabBar = (
    props: SceneRendererProps & { navigationState: State }
  ) => (
    <TabBar
      {...props}
      scrollEnabled
      indicatorStyle={styles.indicator}
      style={styles.tabbar}
      tabStyle={styles.tab}
      labelStyle={styles.label}
    />
  );

  render() {
    return (
      <CollapsibleHeader
        // This is dummy data, we render the entire content as a single component for both tabs
        // TODO: Create an example which explains why we do it this way, by showing proper use of the underlying FlatList
        tabData={[[{ key: '0' }], [{ key: '1' }], [{ key: '2' }]]}
        tabBarHeight={TAB_BAR_HEIGHT}
        headerHeight={HEADER_HEIGHT}
        renderTabItems={[
          this.renderTabOne,
          this.renderTabTwo,
          this.renderTabThree,
        ]}
        renderHeader={this.renderHeader}
        renderTabBar={this.renderTabBar}
        onIndexChange={this.handleIndexChange}
        navigationState={this.state}
      />
    );
  }

  renderTabOne = () => <Albums />;

  renderTabTwo = () => <Contacts />;

  renderTabThree = () => <Article />;

  renderHeader = () => (
    <View style={styles.headerRow}>
      <View style={styles.headerCol}>
        <Text style={styles.text}>Collapsible Header</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabbar: {
    backgroundColor: '#3f51b5',
  },
  tab: {
    width: 120,
  },
  indicator: {
    backgroundColor: '#ffeb3b',
  },
  label: {
    fontWeight: '400',
  },
  headerRow: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    backgroundColor: '#429BB8',
  },
  headerCol: {
    flex: 1,
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
    fontSize: 24,
  },
});
