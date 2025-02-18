/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  EuiButtonEmpty,
  EuiContextMenuPanel,
  EuiPanel,
  EuiPopover,
  EuiSelectable,
  EuiSwitch,
} from '@elastic/eui';
import { i18n } from '@osd/i18n';
import {
  IUiSettingsClient,
  SavedObjectsClientContract,
  ToastsStart,
} from 'opensearch-dashboards/public';
import { getApplication, getDataSourcesWithFields, handleDataSourceFetchError } from '../utils';
import { SavedObject } from '../../../../../core/public';
import { DataSourceAttributes } from '../../types';
import { NoDataSource } from '../no_data_source';
import { DataSourceErrorMenu } from '../data_source_error_menu';
import { DataSourceBaseState } from '../data_source_menu/types';
import { DataSourceOption } from '../data_source_menu/types';
import { DataSourceItem } from '../data_source_item';
import { DataSourceDropDownHeader } from '../drop_down_header';
import './data_source_aggregated_view.scss';

interface DataSourceAggregatedViewProps {
  savedObjectsClient: SavedObjectsClientContract;
  notifications: ToastsStart;
  hideLocalCluster: boolean;
  fullWidth: boolean;
  activeDataSourceIds?: string[];
  dataSourceFilter?: (dataSource: SavedObject<DataSourceAttributes>) => boolean;
  displayAllCompatibleDataSources: boolean;
  uiSettings?: IUiSettingsClient;
}

interface DataSourceAggregatedViewState extends DataSourceBaseState {
  isPopoverOpen: boolean;
  allDataSourcesIdToTitleMap: Map<string, any>;
  switchChecked: boolean;
  defaultDataSource: string | null;
}

interface DataSourceOptionDisplay extends DataSourceOption {
  disabled?: boolean;
  checked?: string;
}

export class DataSourceAggregatedView extends React.Component<
  DataSourceAggregatedViewProps,
  DataSourceAggregatedViewState
> {
  private _isMounted: boolean = false;

  constructor(props: DataSourceAggregatedViewProps) {
    super(props);

    this.state = {
      isPopoverOpen: false,
      allDataSourcesIdToTitleMap: new Map(),
      showEmptyState: false,
      showError: false,
      switchChecked: false,
      defaultDataSource: null,
    };
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  onDataSourcesClick() {
    this.setState({ ...this.state, isPopoverOpen: !this.state.isPopoverOpen });
  }

  onSwitchClick(e) {
    this.setState({ ...this.state, switchChecked: e.target.checked });
  }

  closePopover() {
    this.setState({ ...this.state, isPopoverOpen: false });
  }

  async componentDidMount() {
    this._isMounted = true;
    getDataSourcesWithFields(this.props.savedObjectsClient, ['id', 'title', 'auth.type'])
      .then((fetchedDataSources) => {
        const allDataSourcesIdToTitleMap = new Map();

        if (fetchedDataSources?.length) {
          let filteredDataSources = fetchedDataSources;
          if (this.props.dataSourceFilter) {
            filteredDataSources = fetchedDataSources.filter((ds) =>
              this.props.dataSourceFilter!(ds)
            );
          }

          filteredDataSources.forEach((ds) => {
            allDataSourcesIdToTitleMap.set(ds.id, ds.attributes!.title || '');
          });

          if (!this._isMounted) return;
        }

        if (!this.props.hideLocalCluster) {
          allDataSourcesIdToTitleMap.set('', 'Local cluster');
        }

        this.setState({
          ...this.state,
          allDataSourcesIdToTitleMap,
          defaultDataSource: this.props.uiSettings?.get('defaultDataSource', null) ?? null,
          showEmptyState: allDataSourcesIdToTitleMap.size === 0,
        });
      })
      .catch(() => {
        handleDataSourceFetchError(this.onError.bind(this), this.props.notifications);
      });
  }

  onError() {
    this.setState({ showError: true });
  }

  render() {
    if (this.state.showEmptyState) {
      return <NoDataSource />;
    }
    if (this.state.showError) {
      return <DataSourceErrorMenu />;
    }
    const button = (
      <EuiButtonEmpty
        className="euiHeaderLink"
        data-test-subj="dataSourceAggregatedViewContextMenuHeaderLink"
        aria-label={i18n.translate('dataSourceAggregatedView.dataSourceOptionsButtonAriaLabel', {
          defaultMessage: 'dataSourceAggregatedViewMenuButton',
        })}
        iconType="database"
        iconSide="left"
        size="s"
        onClick={this.onDataSourcesClick.bind(this)}
      />
    );

    let items: DataSourceOptionDisplay[] = [];

    // only display active data sources
    if (!this.props.displayAllCompatibleDataSources && this.state.switchChecked) {
      items = this.props
        .activeDataSourceIds!.filter((id) => this.state.allDataSourcesIdToTitleMap.has(id))
        .map((id) => {
          return {
            id,
            label: this.state.allDataSourcesIdToTitleMap.get(id),
            disabled: true,
            checked: 'on',
          };
        });
    } else {
      this.state.allDataSourcesIdToTitleMap.forEach((label, id) => {
        items.push({
          id,
          label,
          disabled: true,
          checked:
            !this.props.displayAllCompatibleDataSources &&
            this.props.activeDataSourceIds &&
            this.props.activeDataSourceIds.length &&
            this.props.activeDataSourceIds.includes(id)
              ? 'on'
              : undefined,
        });
      });
    }

    const numSelectedItems = items.filter((item) => item.checked === 'on').length;

    const titleComponent = (
      <DataSourceDropDownHeader
        totalDataSourceCount={this.state.allDataSourcesIdToTitleMap.size}
        activeDataSourceCount={
          !this.props.displayAllCompatibleDataSources ? numSelectedItems : undefined
        }
        application={getApplication()}
      />
    );

    return (
      <>
        <EuiPopover
          id={'dataSourceSViewContextMenuPopover'}
          button={button}
          isOpen={this.state.isPopoverOpen}
          closePopover={this.closePopover.bind(this)}
          panelPaddingSize="none"
          anchorPosition="downLeft"
        >
          <EuiContextMenuPanel>
            <EuiPanel
              className={'dataSourceAggregatedViewOuiPanel'}
              borderRadius="none"
              hasBorder={false}
              color="transparent"
              paddingSize="s"
            >
              {titleComponent}
            </EuiPanel>
            <EuiPanel
              className={'dataSourceAggregatedViewOuiPanel'}
              paddingSize="none"
              borderRadius="none"
              hasShadow={false}
            >
              <EuiPanel
                className={'dataSourceAggregatedViewOuiPanel'}
                color="subdued"
                paddingSize="s"
                borderRadius="none"
              >
                <EuiSelectable
                  options={items}
                  renderOption={(option) => (
                    <DataSourceItem
                      className={'dataSourceAggregatedView'}
                      option={option}
                      defaultDataSource={this.state.defaultDataSource}
                    />
                  )}
                >
                  {(list) => list}
                </EuiSelectable>
              </EuiPanel>
            </EuiPanel>
            {!this.props.displayAllCompatibleDataSources && (
              <EuiPanel
                className={'dataSourceAggregatedViewOuiPanel'}
                color="transparent"
                hasBorder={false}
                hasShadow={false}
                borderRadius="m"
              >
                <EuiSwitch
                  className="dataSourceAggregatedViewOuiSwitch"
                  label={`Used on this page (${numSelectedItems})`}
                  checked={this.state.switchChecked}
                  onChange={(e) => this.onSwitchClick(e)}
                  compressed={true}
                />
              </EuiPanel>
            )}
          </EuiContextMenuPanel>
        </EuiPopover>
      </>
    );
  }
}
